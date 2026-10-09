import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import core from '../content/bank/core.json';
import en from '../content/langs/en/pack.json';
import zh from '../content/langs/zh/pack.json';
import { bankSpan, expectedMidi, outOfRange, presetRange, targets, toneBase, transposition, VOICE_PRESETS } from '../src/bank/calibrate';
import { ABOVE, BELOW, FALSETTO_ABOVE, compileBank, compileExercise, place, TENOR, type PlaceContext } from '../src/bank/compile';
import tenorNotes from './fixtures/tenor-bank-notes.json';
import type { RawBank, RawExercise } from '../src/bank/types';
import tips from '../src/i18n/tips.pt-BR.json';
import { noteToMidi } from '../src/lib/music';

const sources = [core, en, zh] as unknown as RawBank[];
const bank = compileBank(sources);
const schema = (n: string) => JSON.parse(fs.readFileSync(`schema/${n}.schema.json`, 'utf8'));

describe('content', () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictTuples: false });
  for (const s of ['exercise', 'bank', 'langpack']) ajv.addSchema(schema(s), `${s}.schema.json`);

  it('validates against the JSON schemas', () => {
    expect(ajv.validate('bank.schema.json', core), JSON.stringify(ajv.errors)).toBe(true);
    expect(ajv.validate('langpack.schema.json', en), JSON.stringify(ajv.errors)).toBe(true);
    expect(ajv.validate('langpack.schema.json', zh), JSON.stringify(ajv.errors)).toBe(true);
  });

  it('rejects malformed exercises', () => {
    const base = { id: 'x', cat: 'vowels', mode: 'sustain', dur: 5, tip: 'chest', vowel: 'AAAH', pos: 0.5 };
    const v = ajv.getSchema('exercise.schema.json')!;
    expect(v(base)).toBe(true);
    expect(v({ ...base, pos: 3 })).toBe(false);
    expect(v({ ...base, note: 'C3' })).toBe(false);
    expect(v({ ...base, unknown: 1 })).toBe(false);
    expect(v({ ...base, dur: 60 })).toBe(false);
    expect(v({ ...base, mode: 'glide' })).toBe(false);
    expect(v({ ...base, id: 'Has Spaces' })).toBe(false);
  });

  it('compiles 131 exercises with unique ids, known tips and continuous numbering', () => {
    expect(bank).toHaveLength(131);
    expect(new Set(bank.map(e => e.id)).size).toBe(bank.length);
    bank.forEach((e, i) => {
      expect(e.n).toBe(i + 1);
      expect(tips).toHaveProperty(e.tip);
    });
  });

  it('keeps categories contiguous and in order', () => {
    const order = [...new Set(bank.map(e => e.cat))];
    expect(order).toEqual(['vowels', 'glides', 'speech', 'phonemes', 'dynamics']);
  });

  it('builds a karaoke schedule that covers the take exactly', () => {
    for (const e of bank) {
      expect(e.sched.length).toBeGreaterThan(0);
      expect(e.sched[0].t0).toBe(0);
      expect(e.sched.at(-1)!.t1).toBeCloseTo(e.dur, 9);
      for (let i = 1; i < e.sched.length; i++) expect(e.sched[i].t0).toBeCloseTo(e.sched[i - 1].t1, 9);
    }
  });

  it('gives Mandarin syllables tone contours', () => {
    const ex = compileExercise({ id: 'z', cat: 'phonemes', mode: 'tones', dur: 4, tip: 'tones', syl: [['mā', '妈', 1], '·', ['mà', '骂', 4]] } as RawExercise, 1, 'zh');
    expect(ex.syl[0].f!.length).toBe(2);
    expect(ex.syl[2].f![0]).toBeGreaterThan(ex.syl[2].f![1]); // tone 4 falls
    expect(ex.sched).toHaveLength(2);
  });
});

describe('placing the bank in a range', () => {
  const ctxFor = (lo: string, hi: string): PlaceContext => ({ low: noteToMidi(lo), high: noteToMidi(hi), toneBase: noteToMidi(lo) });
  const allowed = (e: { syl: { f?: number[] }[]; mode: string; rg: string }, c: PlaceContext) =>
    e.mode === 'tones' || e.syl.every(s => (s.f ?? []).every(m => m >= c.low - BELOW && m <= (e.rg === 'falsetto' ? c.high + FALSETTO_ABOVE : c.high + ABOVE)));

  it('reproduces the original tenor notes exactly for C3–G4', () => {
    const got: Record<string, number[][]> = {};
    for (const e of compileBank(sources, TENOR)) if (e.pitched) got[e.id] = e.syl.filter(s => s.f).map(s => s.f!);
    for (const [id, notes] of Object.entries(tenorNotes)) {
      expect(got[id]).toEqual(notes);
    }
  });

  it.each(Object.keys(VOICE_PRESETS) as (keyof typeof VOICE_PRESETS)[])('keeps every sung note inside the %s range', v => {
    const c = { ...presetRange(v), toneBase: presetRange(v).low };
    const b = compileBank(sources, c);
    expect(b.every(e => allowed(e, c))).toBe(true);
    const sp = bankSpan(b, 0);
    expect(sp.lo).toBe(c.low);
    expect(sp.hi).toBeLessThanOrEqual(c.high + FALSETTO_ABOVE);
  });

  it('spreads sustained notes over the range and runs the extension siren edge to edge', () => {
    const c = ctxFor('A3', 'E5');
    const b = compileBank(sources, c);
    const sus = b.filter(e => e.mode === 'sustain').map(e => e.syl.find(s => s.f)!.f![0]);
    expect(Math.min(...sus)).toBe(c.low);
    expect(Math.max(...sus)).toBeGreaterThanOrEqual(c.high);
    const siren = b.find(e => e.id === 'g-uu-c3-g4-c3')!;
    expect(siren.syl[0].f).toEqual([c.low, c.high, c.low]);
  });

  it('keeps melodic intervals intact when moving a phrase', () => {
    const c = ctxFor('F2', 'C4');
    const tenor = compileBank(sources, TENOR).find(e => e.mode === 'melody')!;
    const moved = compileBank(sources, c).find(e => e.id === tenor.id)!;
    const iv = (e: typeof tenor) => e.syl.map(s => s.f![0] - e.syl[0].f![0]);
    expect(iv(moved)).toEqual(iv(tenor));
  });

  it('shifts a phrase down as a whole when it would pass the top', () => {
    const c = ctxFor('C3', 'G4');
    expect(place(1, [0, 4, 7], c)).toEqual([62, 66, 69]); // G4 root would reach D5; moved so the top is A4
    expect(place(0, [0, -3], c)).toEqual([50, 47]); // below the bottom: moved up
  });

  it('centres a phrase wider than a very narrow range', () => {
    const c = ctxFor('C3', 'G3');
    const ns = place(0.5, [0, 12], c);
    expect(ns[1] - ns[0]).toBe(12);
    expect(Math.abs(ns[0] - (c.low - BELOW) - ((c.high + ABOVE) - ns[1]))).toBeLessThanOrEqual(1);
  });

  it('starts tone contours a little under the measured speaking pitch', () => {
    expect(toneBase({ low: 48 }, null)).toBe(48);
    expect(toneBase({ low: 48 }, 45.4)).toBe(42);
    const c = { ...ctxFor('A3', 'E5'), toneBase: 55 };
    const zh1 = compileBank(sources, c).find(e => e.mode === 'tones')!;
    expect(Math.min(...zh1.syl.flatMap(s => s.f ?? []))).toBe(55);
  });

  it('adds the fine adjust and the pass offset', () => {
    expect(transposition({ transpose: 1, pass: 2 })).toBe(3);
    expect(transposition({ transpose: 0, pass: 3 })).toBe(-2);
  });

  it('flags only exercises that leave the allowed band', () => {
    const c = ctxFor('C3', 'G4');
    const b = compileBank(sources, c);
    expect(b.filter(e => outOfRange(e, 0, c))).toHaveLength(0);
    expect(b.filter(e => outOfRange(e, 3, c)).length).toBeGreaterThan(0);
    expect(b.filter(e => outOfRange(e, 3, c)).every(e => targets(e, 3).some(m => m > c.high + 2))).toBe(true);
  });

  it('interpolates the expected pitch along a siren', () => {
    const e = bank.find(x => x.mode === 'glide')!;
    const [a, b] = e.syl[0].f!;
    expect(expectedMidi(e, 0, 0)).toBe(a);
    expect(expectedMidi(e, e.dur / 2, 2)).toBeCloseTo((a + b) / 2 + 2, 6);
    expect(expectedMidi(e, e.dur + 1, 0)).toBeNull();
  });
});
