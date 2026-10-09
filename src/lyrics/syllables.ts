/**
 * Rough syllable splitting for sung guides. It does not need to be dictionary-exact:
 * it only decides how many notes a word gets and where the karaoke highlight moves.
 */

export type LyricLang = 'en' | 'pt' | 'es' | 'zh' | 'other';

const VOWELS: Record<Exclude<LyricLang, 'zh'>, string> = {
  en: 'aeiouyAEIOUY',
  pt: 'aeiouáéíóúâêôãõàüAEIOUÁÉÍÓÚÂÊÔÃÕÀÜ',
  es: 'aeiouáéíóúüAEIOUÁÉÍÓÚÜ',
  other: 'aeiouyáéíóúâêôãõàèìòùäëïöüAEIOUYÁÉÍÓÚÂÊÔÃÕÀÈÌÒÙÄËÏÖÜ',
};

/** Consonant pairs that start a syllable together (pr-, bl-, ch-, lh-…). */
const ONSETS: Record<Exclude<LyricLang, 'zh'>, string[]> = {
  en: ['bl', 'br', 'ch', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr', 'ph', 'pl', 'pr', 'sc', 'sh', 'sk', 'sl', 'sm', 'sn', 'sp', 'st', 'sw', 'th', 'tr', 'tw', 'wh', 'wr'],
  pt: ['bl', 'br', 'ch', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr', 'gu', 'lh', 'nh', 'pl', 'pr', 'qu', 'tr', 'vr'],
  es: ['bl', 'br', 'ch', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr', 'll', 'pl', 'pr', 'tr'],
  other: ['bl', 'br', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr', 'pl', 'pr', 'tr'],
};

/** Splits one word (letters only, punctuation kept on the last piece) into syllables. */
export function syllabifyWord(word: string, lang: LyricLang): string[] {
  if (lang === 'zh') return [word];
  const m = /^([^\p{L}]*)([\p{L}'’-]+?)([^\p{L}]*)$/u.exec(word);
  if (!m) return [word];
  const [, pre, core, post] = m;
  const V = VOWELS[lang], on = ONSETS[lang];
  const isV = (c: string) => V.includes(c);
  // English silent final e ("make", "love") does not make a syllable.
  let body = core;
  let tail = '';
  if (lang === 'en' && /[^aeiouy]e$/i.test(body) && !/le$/i.test(body) && body.length > 3) {
    tail = body.slice(-1);
    body = body.slice(0, -1);
  }
  // vowel nuclei positions
  const nuclei: [number, number][] = [];
  for (let i = 0; i < body.length; ) {
    if (isV(body[i]) && !(lang !== 'en' && i > 0 && (body[i] === 'u' || body[i] === 'U') && /[qg]/i.test(body[i - 1]) && i + 1 < body.length && /[eiéêí]/i.test(body[i + 1]))) {
      let j = i;
      while (j + 1 < body.length && isV(body[j + 1])) j++;
      nuclei.push([i, j]);
      i = j + 1;
    } else i++;
  }
  if (nuclei.length <= 1) return [pre + core + post];
  const cuts: number[] = [];
  for (let k = 0; k < nuclei.length - 1; k++) {
    const a = nuclei[k][1] + 1, b = nuclei[k + 1][0];
    const cons = body.slice(a, b);
    let cut: number;
    if (cons.length === 0) cut = a;
    else if (cons.length === 1) cut = a;
    else {
      const last2 = cons.slice(-2).toLowerCase();
      cut = on.includes(last2) ? b - 2 : b - 1;
    }
    cuts.push(cut);
  }
  const parts: string[] = [];
  let s = 0;
  for (const c of cuts) {
    parts.push(body.slice(s, c));
    s = c;
  }
  parts.push(body.slice(s) + tail);
  const clean = parts.filter(Boolean);
  clean[0] = pre + clean[0];
  clean[clean.length - 1] += post;
  return clean;
}

/**
 * Splits a line into sung syllables. Pieces that continue a word end in "-", which is how
 * the teleprompter joins them back together.
 */
export function syllabifyLine(line: string, lang: LyricLang): string[] {
  if (lang === 'zh') return [...line.replace(/[\s，。！？、,.!?]/g, '')];
  const out: string[] = [];
  for (const w of line.split(/\s+/).filter(Boolean)) {
    const parts = syllabifyWord(w, lang);
    parts.forEach((p, i) => out.push(i < parts.length - 1 ? p + '-' : p));
  }
  return out;
}

/* ---------------- Mandarin pinyin ---------------- */

const TONE_MARKS: Record<string, number> = {};
('āēīōūǖ'.split('')).forEach(c => (TONE_MARKS[c] = 1));
('áéíóúǘ'.split('')).forEach(c => (TONE_MARKS[c] = 2));
('ǎěǐǒǔǚ'.split('')).forEach(c => (TONE_MARKS[c] = 3));
('àèìòùǜ'.split('')).forEach(c => (TONE_MARKS[c] = 4));

/** Tone of one pinyin syllable: marks (mā) or trailing digits (ma1, ma5 = neutral). */
export function pinyinTone(syl: string): 0 | 1 | 2 | 3 | 4 {
  const d = /([0-5])$/.exec(syl);
  if (d) return (+d[1] % 5) as 0 | 1 | 2 | 3 | 4;
  for (const c of syl.toLowerCase()) if (TONE_MARKS[c]) return TONE_MARKS[c] as 1 | 2 | 3 | 4;
  return 0;
}

export const hasHanzi = (s: string): boolean => /\p{Script=Han}/u.test(s);

/**
 * Parses a Mandarin lyric line written as "汉字 | pīnyīn" (either half optional).
 * Returns hanzi characters and pinyin syllables with tones; the lists may differ in length.
 */
export function parseMandarin(line: string): { hanzi: string[]; pinyin: { py: string; tone: 0 | 1 | 2 | 3 | 4 }[] } {
  const [a, b] = line.split('|').map(x => x.trim());
  const hzPart = hasHanzi(a) ? a : b && hasHanzi(b) ? b : '';
  const pyPart = !hasHanzi(a) ? a : b && !hasHanzi(b) ? b : '';
  const hanzi = [...hzPart.replace(/[^\p{Script=Han}]/gu, '')];
  const pinyin = (pyPart ?? '')
    .split(/[\s,.;!?，。！？'’-]+/)
    .filter(Boolean)
    .map(py => ({ py: py.replace(/[0-5]$/, ''), tone: pinyinTone(py) }));
  return { hanzi, pinyin };
}
