import { describe, expect, it } from 'vitest';
import { compileBank, TENOR } from '../src/bank/compile';
import { exercisesFor, lineId, lyricsBank, melodyFor, parseLines, type LyricLabels } from '../src/lyrics/generate';
import { parseMandarin, pinyinTone, syllabifyLine, syllabifyWord } from '../src/lyrics/syllables';

const L: LyricLabels = Object.fromEntries(
  ['speech', 'fast', 'slow', 'sung', 'subSpeech', 'subFast', 'subSlow', 'subSung', 'regSpeech', 'regSung', 'tagSpeech', 'tagFast', 'tagSlow'].map(k => [k, { en: k }]),
) as unknown as LyricLabels;

describe('syllables', () => {
  it.each([
    ['breathing', 'en', ['brea', 'thing']],
    ['nothing', 'en', ['no', 'thing']],
    ['make', 'en', ['make']],
    ['river', 'en', ['ri', 'ver']],
    ['saudade', 'pt', ['sau', 'da', 'de']],
    ['carro', 'pt', ['car', 'ro']],
    ['falha', 'pt', ['fa', 'lha']],
    ['quero', 'pt', ['que', 'ro']],
    ['outra', 'pt', ['ou', 'tra']],
    ['corazón', 'es', ['co', 'ra', 'zón']],
    ['calle', 'es', ['ca', 'lle']],
  ] as const)('%s (%s)', (w, lang, want) => {
    expect(syllabifyWord(w, lang)).toEqual(want);
  });

  it('keeps punctuation and marks word continuations for the teleprompter', () => {
    expect(syllabifyLine('Let me breathe, river!', 'en')).toEqual(['Let', 'me', 'breathe,', 'ri-', 'ver!']);
  });

  it('splits Mandarin into characters and reads pinyin tones', () => {
    expect(syllabifyLine('你好，世界', 'zh')).toEqual(['你', '好', '世', '界']);
    expect(pinyinTone('mā')).toBe(1);
    expect(pinyinTone('hǎo')).toBe(3);
    expect(pinyinTone('ma5')).toBe(0);
    expect(pinyinTone('ni3')).toBe(3);
    const r = parseMandarin('你好 | nǐ hǎo');
    expect(r.hanzi).toEqual(['你', '好']);
    expect(r.pinyin).toEqual([{ py: 'nǐ', tone: 3 }, { py: 'hǎo', tone: 3 }]);
    expect(parseMandarin('ni3 hao3').pinyin.map(p => p.py)).toEqual(['ni', 'hao']);
  });
});

describe('my lyrics', () => {
  it('cleans pasted text: blank lines, section headings and duplicates', () => {
    const lines = parseLines('[Chorus]\n\nHold the light\n  Hold   the light \nSecond line', 'en');
    expect(lines.map(l => l.text)).toEqual(['Hold the light', 'Second line']);
    expect(parseLines('Second line\nThird', 'en', lines).map(l => l.text)).toEqual(['Third']);
  });

  it('gives a stable id per text and language', () => {
    expect(lineId('abc', 'en')).toBe(lineId('abc', 'en'));
    expect(lineId('abc', 'en')).not.toBe(lineId('abc', 'pt'));
  });

  it('creates speech, fast, slow and sung exercises per line', () => {
    const [line] = parseLines('Take me back to that one morning', 'en');
    const ex = exercisesFor(line, L);
    expect(ex.map(e => e.mode)).toEqual(['speech', 'speech', 'speech', 'melody']);
    expect(ex[1].dur).toBeLessThan(ex[0].dur);
    expect(ex[2].dur).toBeGreaterThan(ex[0].dur);
    expect(ex.every(e => e.cat === 'lyrics')).toBe(true);
  });

  it('uses tone contours for Mandarin written with pinyin', () => {
    const [line] = parseLines('我们一起唱吧 | wǒ men yì qǐ chàng ba', 'zh');
    const ex = exercisesFor(line, L);
    expect(ex[0].mode).toBe('tones');
    const mel = ex[3];
    expect(mel.mode === 'melody' && mel.notes.length).toBe(6);
  });

  it('writes a singable pentatonic melody that resolves', () => {
    const m = melodyFor(9, 'abc');
    expect(m).toHaveLength(9);
    expect(m[0]).toBe(0);
    expect(Math.max(...m) - Math.min(...m)).toBeLessThanOrEqual(12);
    expect(melodyFor(9, 'abc')).toEqual(m);
  });

  it('compiles into the last category, inside the range', () => {
    const lines = parseLines('Hold the light until the morning comes\nI drift', 'en');
    const b = compileBank([lyricsBank(lines, L)], TENOR);
    expect(b).toHaveLength(8);
    const sung = b.filter(e => e.mode === 'melody').flatMap(e => e.syl.map(s => s.f![0]));
    expect(Math.min(...sung)).toBeGreaterThanOrEqual(TENOR.low - 1);
    expect(Math.max(...sung)).toBeLessThanOrEqual(TENOR.high + 2);
  });
});
