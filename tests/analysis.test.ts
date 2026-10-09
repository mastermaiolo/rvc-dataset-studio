import { describe, expect, it } from 'vitest';
import { coverage, summarize, tuningClass } from '../src/analysis/coverage';
import { analyzeVoiceTest } from '../src/analysis/profile';
import { analyzeTake, qcList, worst, type Take } from '../src/analysis/qc';
import { ltas } from '../src/analysis/spectrum';
import { compileExercise } from '../src/bank/compile';
import type { RawExercise } from '../src/bank/types';
import { midiToHz, noteToMidi } from '../src/lib/music';
import { cat, glide, mix, noise, SR, silence, voiced } from './signals';

/** A sustained vowel placed exactly on `note` (the bottom of a range starting there). */
const sustain = (note: string) =>
  compileExercise({ id: 's', cat: 'vowels', mode: 'sustain', vowel: 'AAAH', pos: 0, dur: 5, tip: 'chest' } as RawExercise, 1, 'core',
    { low: noteToMidi(note), high: noteToMidi(note) + 12, toneBase: 48 });
const speech = compileExercise({ id: 'sp', cat: 'speech', mode: 'speech', text: 'Hello there, friend.', dur: 4, tip: 'speech' } as RawExercise, 2, 'en');
const opts = { thrDb: -42, trim: true, tr: 0 };
const room = (x: Float32Array, seed = 3) => mix(x, noise(x.length / SR, 0.0005, seed));

function take(raw: Float32Array, ex = sustain('A3'), tr = 0): Take {
  return { key: 'k', id: ex.id, n: 1, pass: 1, ts: 0, ...analyzeTake(raw, SR, ex, { ...opts, tr }) };
}

describe('take quality control', () => {
  it('passes a clean, in-tune sustained note', () => {
    const t = take(room(cat(silence(0.5), voiced(midiToHz(noteToMidi('A3')), 5, 0.35), silence(0.5))));
    expect(t.voiced).toBeGreaterThan(4.9);
    expect(t.voiced).toBeLessThan(5.1);
    expect(t.pitch?.kind).toBe('cents');
    if (t.pitch?.kind === 'cents') {
      expect(Math.abs(t.pitch.signed)).toBeLessThan(3);
      expect(t.pitch.within).toBeGreaterThan(0.95);
    }
    expect(worst(qcList(t))).toBe('ok');
  });

  it('measures a sharp note in cents', () => {
    const t = take(room(voiced(midiToHz(noteToMidi('A3') + 0.4), 5, 0.35)));
    expect(t.pitch?.kind).toBe('cents');
    if (t.pitch?.kind === 'cents') expect(t.pitch.signed).toBeCloseTo(40, -1);
    expect(qcList(t).find(q => q.k === 'tuning')!.s).toBe('bad');
  });

  it('respects the transposition in effect', () => {
    const t = take(room(voiced(midiToHz(noteToMidi('A3') + 3), 5, 0.35)), sustain('A3'), 3);
    expect(t.pitch?.kind === 'cents' && Math.abs(t.pitch.signed) < 3).toBe(true);
  });

  it('flags clipping, quiet takes and a noisy room', () => {
    const hot = take(voiced(220, 5, 1.2).map(v => Math.max(-1, Math.min(1, v))));
    expect(hot.clip).toBe(true);
    expect(qcList(hot).find(q => q.k === 'peak')!.s).toBe('bad');
    const quiet = take(room(voiced(220, 5, 0.03)));
    expect(qcList(quiet).find(q => q.k === 'peak')!.s).toBe('bad');
    const noisy = take(mix(voiced(220, 5, 0.3), noise(5, 0.02)));
    expect(qcList(noisy).find(q => q.k === 'floor')!.s).not.toBe('ok');
  });

  it('marks rehearsal takes as external without audio checks', () => {
    const L = qcList({ key: 'k', id: 'x', n: 1, pass: 1, ts: 0, external: true, rehearsal: true, dur: 5, voiced: 5 });
    expect(L.map(q => q.k)).toEqual(['origin', 'estimated']);
  });
});

describe('dataset range map', () => {
  it('bins sung seconds on the target note with their tuning', () => {
    const t = take(room(voiced(midiToHz(noteToMidi('C4')), 4, 0.35)), sustain('C4'));
    const h = t.hist!;
    const c4 = noteToMidi('C4');
    expect(h[c4].s).toBeGreaterThan(3.5);
    expect(h[c4].f).toBe(0);
    expect(tuningClass(h[c4])).toBe('ok');
  });

  it('counts speech separately', () => {
    const t = take(room(voiced(130, 3, 0.3)), speech);
    const total = Object.values(t.hist!).reduce((a, e) => a + e.f, 0);
    expect(total).toBeGreaterThan(2.5);
    expect(Object.values(t.hist!).every(e => e.s === 0)).toBe(true);
  });

  it('aggregates takes and reports gaps inside the range', () => {
    const notes = ['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4'];
    const ts = notes.map(n => take(room(voiced(midiToHz(noteToMidi(n)), 5, 0.35)), sustain(n)));
    const cov = coverage(ts);
    expect(cov.sung).toBeGreaterThan(38);
    const sm = summarize(cov, { low: noteToMidi('C3'), high: noteToMidi('D4') });
    expect(sm.enoughData).toBe(true);
    expect(sm.gaps).toContain(noteToMidi('C#4'));
    expect(sm.gaps).toContain(noteToMidi('D4'));
    expect(sm.gaps).not.toContain(noteToMidi('A3'));
  });
});

describe('vocal profile test', () => {
  it('estimates extension, comfortable range and speaking pitch', () => {
    const lo = noteToMidi('A2'), hi = noteToMidi('A4');
    const siren = cat(glide(midiToHz(lo), midiToHz(hi), 7), glide(midiToHz(hi), midiToHz(lo), 7));
    const speechSig = cat(voiced(midiToHz(noteToMidi('B2')), 4, 0.3), voiced(midiToHz(noteToMidi('D3')), 4, 0.3));
    const sustainSig = voiced(midiToHz(noteToMidi('E3')), 6, 0.35);
    const r = analyzeVoiceTest({ siren: room(siren), speech: room(speechSig, 4), sustain: room(sustainSig, 5) }, SR, -42);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const P = r.profile;
    expect(Math.abs(P.sirenLow - lo)).toBeLessThan(1);
    expect(Math.abs(P.sirenHigh - hi)).toBeLessThan(1);
    expect(P.low).toBe(Math.round(P.sirenLow) + 1);
    expect(P.high).toBe(Math.round(P.sirenHigh) - 2);
    expect(Math.abs(P.comfort! - noteToMidi('E3'))).toBeLessThan(0.1);
    expect(P.stab!).toBeLessThan(5);
    expect(P.speech!).toBeGreaterThanOrEqual(noteToMidi('B2') - 0.1);
    expect(P.speech!).toBeLessThanOrEqual(noteToMidi('D3') + 0.1);
    expect(P.types).toContain('baritone');
    expect(P.ltas!.length).toBeGreaterThan(100);
  });

  it('refuses a siren that stays on one note', () => {
    const flat = voiced(midiToHz(noteToMidi('C3')), 14, 0.35);
    expect(analyzeVoiceTest({ siren: room(flat) }, SR, -42)).toEqual({ ok: false, reason: 'narrow-siren' });
  });

  it('refuses a silent siren', () => {
    expect(analyzeVoiceTest({ siren: silence(14) }, SR, -42)).toEqual({ ok: false, reason: 'no-siren' });
  });
});

describe('long-term average spectrum', () => {
  it('finds a presence peak between 2 and 4 kHz', () => {
    const x = mix(voiced(150, 3, 0.3, SR, 4), voiced(3000, 3, 0.05, SR, 1));
    const r = ltas([x], SR, -60)!;
    expect(r.peakHz).toBeGreaterThan(2800);
    expect(r.peakHz).toBeLessThan(3200);
    expect(r.ltas.every(([, d]) => d <= 0)).toBe(true);
  });
});
