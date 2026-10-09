import type { LText, RawBank, RawExercise, ToneMark } from '../bank/types';
import { parseMandarin, syllabifyLine, type LyricLang } from './syllables';

/**
 * "My lyrics": the user pastes lines from their own songs and gets, per line, natural speech,
 * fast and slow/intimate readings and a sung phrase in their range. Everything stays in the browser.
 */

export interface LyricLine {
  id: string;
  text: string;
  lang: LyricLang;
}

export const MAX_LINES = 60;
export const MAX_CHARS = 200;

/** FNV-1a hash → short base-36 id, stable for the same text and language. */
export function lineId(text: string, lang: string): string {
  let h = 0x811c9dc5;
  for (const c of lang + '\u0000' + text) {
    h ^= c.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/** Cleans pasted text into unique lines (blank lines, headings like [Chorus] and duplicates removed). */
export function parseLines(raw: string, lang: LyricLang, existing: LyricLine[] = []): LyricLine[] {
  const seen = new Set(existing.map(l => l.id));
  const out: LyricLine[] = [];
  for (let line of raw.split(/\r?\n/)) {
    line = line.replace(/\s+/g, ' ').trim();
    if (!line || /^[[(].*[\])]$/.test(line)) continue;
    line = line.slice(0, MAX_CHARS);
    const id = lineId(line, lang);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, text: line, lang });
    if (existing.length + out.length >= MAX_LINES) break;
  }
  return out;
}

/** Deterministic PRNG seeded by the line, so a line always gets the same melody. */
function rng(seed: string): () => number {
  let a = parseInt(seed, 36) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PENTA = [0, 2, 4, 7, 9, 12];

/**
 * Melody for n syllables: major-pentatonic arch that rises through the first half,
 * falls through the second and resolves on the tonic. Intervals from the first note.
 */
export function melodyFor(n: number, seed: string): number[] {
  const r = rng(seed);
  const out: number[] = [];
  let i = r() < 0.5 ? 1 : 2;
  for (let k = 0; k < n; k++) {
    const half = k < n / 2;
    if (k > 0) {
      const up = half ? r() < 0.7 : r() < 0.3;
      i = Math.max(0, Math.min(PENTA.length - 1, i + (up ? 1 : -1) * (r() < 0.8 ? 1 : 2)));
    }
    out.push(PENTA[i]);
  }
  if (n > 1) out[n - 1] = r() < 0.6 ? 0 : 2;
  const first = out[0];
  return out.map(x => x - first);
}

const clampDur = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(x)));

export interface LyricLabels {
  speech: LText;
  fast: LText;
  slow: LText;
  sung: LText;
  subSpeech: LText;
  subFast: LText;
  subSlow: LText;
  subSung: LText;
  regSpeech: LText;
  regSung: LText;
  /** Short tags that tell the three spoken versions apart in the list. */
  tagSpeech: LText;
  tagFast: LText;
  tagSlow: LText;
}

const tagged = (text: string, tag: LText): LText => {
  const short = text.split(/\s+/).slice(0, 4).join(' ').replace(/[,.!?]$/, '') + (text.split(/\s+/).length > 4 ? '…' : '');
  return Object.fromEntries(Object.entries(tag).map(([k, v]) => [k, short + ' · ' + v]));
};

export function exercisesFor(line: LyricLine, L: LyricLabels): RawExercise[] {
  const base = { cat: 'lyrics' as const };
  const id = 'ly-' + line.id;
  const out: RawExercise[] = [];
  const zh = line.lang === 'zh' ? parseMandarin(line.text) : null;
  const syl = zh ? (zh.pinyin.length ? zh.pinyin.map(p => p.py) : zh.hanzi) : syllabifyLine(line.text, line.lang);
  const nSyl = Math.max(1, syl.length);
  const normal = clampDur(nSyl / 3.8 + 1.5, 4, 12);
  const speechText = zh ? (zh.hanzi.length ? zh.hanzi.join('') : syl.join(' ')) : line.text;

  if (zh && zh.pinyin.length) {
    const items: [string, string, ToneMark][] = zh.pinyin.map((p, i) => [p.py, zh.hanzi.length === zh.pinyin.length ? zh.hanzi[i] : '', p.tone]);
    out.push({ ...base, id: id + '-t', mode: 'tones', syl: items, dur: normal, tip: 'phrasezh', emo: L.speech, sub: L.subSpeech, reg: L.regSpeech, title: tagged(speechText, L.tagSpeech) });
  } else {
    out.push({ ...base, id: id + '-s', mode: 'speech', text: speechText, dur: normal, tip: 'speech', emo: L.speech, sub: L.subSpeech, reg: L.regSpeech, title: tagged(speechText, L.tagSpeech) });
  }
  out.push({ ...base, id: id + '-f', mode: 'speech', text: speechText, dur: clampDur(normal * 0.65, 3, 9), tip: 'fast', emo: L.fast, sub: L.subFast, reg: L.regSpeech, title: tagged(speechText, L.tagFast) });
  out.push({ ...base, id: id + '-l', mode: 'speech', text: speechText, dur: clampDur(normal * 1.4, 5, 15), tip: 'breathy', emo: L.slow, sub: L.subSlow, reg: L.regSpeech, title: tagged(speechText, L.tagSlow) });

  const mel = melodyFor(nSyl, line.id);
  const notes: [string, number, number][] = syl.map((t, i) => [t, mel[i], i === syl.length - 1 ? 2.5 : /[,.;!?]$/.test(t) ? 1.5 : 1]);
  const sungDur = clampDur(notes.reduce((a, n) => a + n[2], 0) * 0.45 + 1, 4, 14);
  out.push({ ...base, id: id + '-m', mode: 'melody', pos: 0.3, notes, dur: sungDur, tip: zh ? 'lyriczh' : 'lyric', emo: L.sung, sub: L.subSung, reg: L.regSung });
  return out;
}

/** The user's lyrics as a bank source (never saved to the repository or sent anywhere). */
export function lyricsBank(lines: LyricLine[], labels: LyricLabels): RawBank {
  return { id: 'lyrics', user: true, version: 2, exercises: lines.flatMap(l => exercisesFor(l, labels)) };
}

/* ---------------- storage ---------------- */

const KEY = 'rvcds.lyrics.v1';
const LANGS: LyricLang[] = ['en', 'pt', 'es', 'zh', 'other'];

export function loadLyrics(): LyricLine[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(l => l && typeof l.text === 'string' && LANGS.includes(l.lang))
      .slice(0, MAX_LINES)
      .map(l => ({ id: lineId(l.text, l.lang), text: String(l.text).slice(0, MAX_CHARS), lang: l.lang }));
  } catch {
    return [];
  }
}

export function saveLyrics(lines: LyricLine[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {}
}
