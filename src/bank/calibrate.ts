import { noteToMidi } from '../lib/music';
import { ABOVE, BELOW, FALSETTO_ABOVE } from './compile';
import type { Exercise } from './types';

/**
 * Comfortable ranges for the voice-type presets (used when the singer prefers not to take the test).
 * They are deliberately conservative: a comfortable range, not the full extension.
 */
export const VOICE_PRESETS = {
  bass: ['G2', 'D4'],
  baritone: ['A2', 'E4'],
  tenor: ['C3', 'G4'],
  alto: ['F3', 'C5'],
  mezzo: ['A3', 'E5'],
  soprano: ['C4', 'G5'],
} as const;
export type VoiceId = keyof typeof VOICE_PRESETS;
export const presetRange = (v: VoiceId): { low: number; high: number } => ({
  low: noteToMidi(VOICE_PRESETS[v][0]),
  high: noteToMidi(VOICE_PRESETS[v][1]),
});

/** Extra passes move the whole bank so the model hears the same material in other keys. */
export const PASS_OFFSETS: Record<number, number> = { 1: 0, 2: 2, 3: -2 };

export interface Range {
  low: number;
  high: number;
  /** assumed = nothing chosen yet; preset = a voice type; measured = voice test; manual = picked by hand. */
  src: 'assumed' | 'preset' | 'measured' | 'manual';
  preset?: VoiceId;
}

/** Minimum width of a usable comfortable range, in semitones. */
export const MIN_SPAN = 7;

export interface TransposeInput {
  transpose: number;
  pass: number;
}

/** Semitones applied on top of the placed bank: fine adjust plus the pass offset. */
export function transposition(s: TransposeInput): number {
  return Number(s.transpose || 0) + (PASS_OFFSETS[s.pass] ?? 0);
}

/** Distinct target notes of an exercise after transposition. */
export function targets(ex: Exercise, tr: number): number[] {
  return [...new Set(ex.syl.filter(s => s.f).flatMap(s => s.f as number[]))].map(m => m + tr);
}

/** Pitch the singer should be on `t` seconds into the take (interpolated along glides and contours). */
export function expectedMidi(ex: Exercise, t: number, tr: number): number | null {
  const s = ex.sched.find(x => t >= x.t0 && t < x.t1);
  if (!s || !s.f) return null;
  if (s.f.length === 1) return s.f[0] + tr;
  const p = ((t - s.t0) / (s.t1 - s.t0)) * (s.f.length - 1);
  const j = Math.min(Math.floor(p), s.f.length - 2);
  const r = p - j;
  return s.f[j] + (s.f[j + 1] - s.f[j]) * r + tr;
}

/** Whether a sung exercise reaches outside the allowed range (tops may go 2 st above, falsetto up to 7 st above). */
export function outOfRange(ex: Exercise, tr: number, range: { low: number; high: number }): 'above' | 'below' | null {
  if (!ex.pitched || ex.mode === 'tones') return null;
  const ns = targets(ex, tr);
  const maxAbove = ex.rg === 'falsetto' ? FALSETTO_ABOVE : ABOVE;
  if (Math.max(...ns) > range.high + maxAbove) return 'above';
  if (Math.min(...ns) < range.low - BELOW) return 'below';
  return null;
}

/** Lowest and highest sung note of the whole bank after transposition. */
export function bankSpan(bank: Exercise[], tr: number): { lo: number; hi: number } {
  let lo = Infinity, hi = -Infinity;
  for (const e of bank) {
    if (!e.pitched || e.mode === 'tones') continue;
    for (const s of e.syl) for (const m of s.f ?? []) {
      lo = Math.min(lo, m + tr);
      hi = Math.max(hi, m + tr);
    }
  }
  return { lo, hi };
}

/** Base pitch for tone-language contours: a little under the measured speaking pitch, else the bottom of the range. */
export function toneBase(range: { low: number }, speech?: number | null): number {
  return speech != null ? Math.round(speech) - 3 : range.low;
}
