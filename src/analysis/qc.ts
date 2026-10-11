import { targets } from '../bank/calibrate';
import type { Exercise } from '../bank/types';
import { dB } from '../lib/music';
import { countClipped, frameLevels, trimSilence, voiceActivity } from './vad';
import { pitchTrack } from './yin';

export type Status = 'ok' | 'warn' | 'bad';

export type PitchQC =
  | { kind: 'none' }
  | { kind: 'off' }
  | { kind: 'range'; lo: number; hi: number; tlo: number; thi: number; ok: boolean }
  | { kind: 'cents'; signed: number; medAbs: number; within: number };

/** Seconds recorded per semitone: sung (s) and spoken (f), plus summed deviation (c, cents) over n frames. */
export type Histogram = Record<number, { s: number; f: number; c: number; n: number }>;

export interface Take {
  key: string;
  /** Exercise id (stable across bank versions) and its position when recorded. */
  id: string;
  n: number;
  pass: number;
  ts: number;
  q?: Status;
  /** Rehearsal/external takes carry no audio: the user recorded them in a DAW. */
  external?: boolean;
  rehearsal?: boolean;
  pcm?: Float32Array;
  sr?: number;
  dur: number;
  voiced: number;
  peakDb?: number;
  clip?: boolean;
  floorDb?: number | null;
  pitch?: PitchQC | null;
  hist?: Histogram;
  /** Transposition in effect when the take was recorded. */
  tr?: number;
  /** Persistence status in local storage (IndexedDB). */
  saveStatus?: 'saved' | 'saving' | 'failed';
}

export const takeKey = (pass: number, id: string): string => pass + ':' + id;

const SUNG = new Set(['sustain', 'glide', 'melody']);

function nearest(m: number, ts: number[]): number {
  let best: number | null = null;
  for (const t of ts) {
    const d = m - t;
    if (best === null || Math.abs(d) < Math.abs(best)) best = d;
  }
  return best ?? Infinity;
}

export function buildHistogram(ms: number[], frame: number, ex: Exercise, tr: number): Histogram {
  const sung = SUNG.has(ex.mode);
  const ts = sung ? targets(ex, tr) : [];
  const h: Histogram = {};
  for (const m of ms) {
    let b = Math.round(m);
    let dev: number | null = null;
    if (sung && ex.mode !== 'glide') {
      const best = nearest(m, ts);
      if (Math.abs(best) <= 1) {
        b = Math.round(m - best);
        dev = Math.abs(best * 100);
      }
    }
    const e = h[b] ?? (h[b] = { s: 0, f: 0, c: 0, n: 0 });
    if (sung) {
      e.s += frame;
      if (dev != null) {
        e.c += dev;
        e.n++;
      }
    } else e.f += frame;
  }
  return h;
}

export function pitchQC(ms: number[], ex: Exercise, tr: number): PitchQC {
  const ts = targets(ex, tr);
  if (ms.length < 6) return { kind: 'none' };
  if (ex.mode === 'glide') {
    const so = ms.slice().sort((a, b) => a - b);
    const lo = so[Math.floor(so.length * 0.05)], hi = so[Math.floor(so.length * 0.95)];
    const tlo = Math.min(...ts), thi = Math.max(...ts);
    return { kind: 'range', lo, hi, tlo, thi, ok: Math.abs(lo - tlo) <= 1.5 && Math.abs(hi - thi) <= 1.5 };
  }
  const devs: number[] = [];
  // skip the attack of sustained notes (first ~100 ms of voiced frames)
  for (const m of ms.slice(ex.mode === 'sustain' ? 5 : 0)) {
    const best = nearest(m, ts);
    if (Math.abs(best) <= 3) devs.push(best * 100);
  }
  if (devs.length < 4) return { kind: 'off' };
  const sg = devs.slice().sort((a, b) => a - b);
  const ab = devs.map(Math.abs).sort((a, b) => a - b);
  return {
    kind: 'cents',
    signed: sg[Math.floor(sg.length / 2)],
    medAbs: ab[Math.floor(ab.length / 2)],
    within: devs.filter(d => Math.abs(d) <= 25).length / devs.length,
  };
}

export interface AnalyzeOptions {
  thrDb: number;
  trim: boolean;
  tr: number;
}

/** Full analysis of a raw take: trim, levels, clipping, noise floor, pitch accuracy and range histogram. */
export function analyzeTake(raw: Float32Array, sr: number, ex: Exercise, o: AnalyzeOptions): Omit<Take, 'key' | 'id' | 'n' | 'pass' | 'ts'> {
  const lv = frameLevels(raw, sr);
  const va = voiceActivity(lv.fdb, o.thrDb);
  const pcm = o.trim ? trimSilence(raw, sr, va, lv.hop) : raw;
  const clip = countClipped(pcm) > 3;
  const tk = pitchTrack(pcm, sr, o.thrDb);
  const pitch = ex.pitched && ex.mode !== 'tones' ? pitchQC(tk.ms, ex, o.tr) : null;
  const hist = buildHistogram(tk.ms, tk.frame, ex, o.tr);
  return { pcm, sr, dur: pcm.length / sr, voiced: va.voiced, peakDb: dB(lv.peak), clip, floorDb: va.floorDb, pitch, hist, tr: o.tr };
}

export type QCKey = 'origin' | 'estimated' | 'voiced' | 'peak' | 'floor' | 'tuning' | 'span' | 'duration';
export interface QCItem {
  k: QCKey;
  s: Status;
  /** Raw values; the UI formats them. */
  v: Record<string, number | string | boolean>;
}

/** Quality checks for one take. Thresholds follow what trains a clean RVC model. */
export function qcList(t: Take): QCItem[] {
  if (t.external) {
    return [
      { k: 'origin', s: 'ok', v: { rehearsal: !!t.rehearsal } },
      { k: 'estimated', s: 'ok', v: { sec: t.voiced } },
    ];
  }
  const L: QCItem[] = [];
  const v = t.voiced;
  L.push({ k: 'voiced', s: v < 3 ? 'bad' : v < 4 || v > 11 ? 'warn' : 'ok', v: { sec: v } });
  const pk = t.peakDb ?? -90;
  L.push({ k: 'peak', s: t.clip ? 'bad' : pk < -24 ? 'bad' : pk < -18 || pk > -2 ? 'warn' : 'ok', v: { db: pk, clip: !!t.clip } });
  const fl = t.floorDb;
  if (fl == null) L.push({ k: 'floor', s: 'warn', v: { none: true } });
  else L.push({ k: 'floor', s: fl < -55 ? 'ok' : fl < -45 ? 'warn' : 'bad', v: { db: fl } });
  const p = t.pitch;
  if (p && p.kind === 'cents')
    L.push({ k: 'tuning', s: p.medAbs <= 15 && p.within >= 0.7 ? 'ok' : p.medAbs <= 30 ? 'warn' : 'bad', v: { kind: 'cents', signed: p.signed, within: p.within } });
  else if (p && p.kind === 'range') L.push({ k: 'span', s: p.ok ? 'ok' : 'warn', v: { lo: p.lo, hi: p.hi, tlo: p.tlo, thi: p.thi } });
  else if (p && p.kind === 'off') L.push({ k: 'tuning', s: 'bad', v: { kind: 'off' } });
  else if (p && p.kind === 'none') L.push({ k: 'tuning', s: 'warn', v: { kind: 'none' } });
  else L.push({ k: 'duration', s: t.dur > 12 ? 'warn' : 'ok', v: { sec: t.dur } });
  return L;
}

export const worst = (L: { s: Status }[]): Status =>
  L.some(x => x.s === 'bad') ? 'bad' : L.some(x => x.s === 'warn') ? 'warn' : 'ok';
