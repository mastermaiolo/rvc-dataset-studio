import type { Exercise, RegisterId } from '../bank/types';
import type { Histogram, Status, Take } from './qc';

export type { RegisterId };

export interface Coverage {
  agg: Histogram;
  /** Total sung and spoken seconds with a detected pitch. */
  sung: number;
  spoken: number;
}

/** Sums the per-take histograms into one dataset-wide range map. */
export function coverage(takes: Iterable<Take>): Coverage {
  const agg: Histogram = {};
  let sung = 0, spoken = 0;
  for (const t of takes) {
    if (!t.hist) continue;
    for (const [m, e] of Object.entries(t.hist)) {
      const a = agg[+m] ?? (agg[+m] = { s: 0, f: 0, c: 0, n: 0 });
      a.s += e.s; a.f += e.f; a.c += e.c; a.n += e.n;
      sung += e.s; spoken += e.f;
    }
  }
  return { agg, sung, spoken };
}

/** Average tuning of one note: ≤12¢ good, ≤25¢ fair, otherwise weak. */
export function tuningClass(e: { c: number; n: number }): Status {
  const m = e.c / e.n;
  return m <= 12 ? 'ok' : m <= 25 ? 'warn' : 'bad';
}

export interface CoverageSummary {
  enoughData: boolean;
  /** Notes inside the comfortable range with under 3 s of singing. */
  gaps: number[];
  aboveSec: number;
  belowSec: number;
  weakest: { midi: number; cents: number } | null;
  speechMedian: number | null;
}

export function summarize(cov: Coverage, range: { low: number; high: number }): CoverageSummary {
  const { agg, sung, spoken } = cov;
  const keys = Object.keys(agg).map(Number).filter(m => agg[m].s + agg[m].f > 0.05);
  const out: CoverageSummary = { enoughData: sung >= 30, gaps: [], aboveSec: 0, belowSec: 0, weakest: null, speechMedian: null };
  if (out.enoughData) {
    for (let m = range.low; m <= range.high; m++) if (!agg[m] || agg[m].s < 3) out.gaps.push(m);
    for (const m of keys) {
      if (m > range.high + 2) out.aboveSec += agg[m].s;
      if (m < range.low - 1) out.belowSec += agg[m].s;
    }
    const tuned = keys.filter(m => agg[m].n >= 20).sort((x, y) => agg[y].c / agg[y].n - agg[x].c / agg[x].n);
    if (tuned.length >= 3) out.weakest = { midi: tuned[0], cents: agg[tuned[0]].c / agg[tuned[0]].n };
  }
  if (spoken > 20) {
    const fk = keys.filter(m => agg[m].f > 0).sort((x, y) => x - y);
    const tot = fk.reduce((a, m) => a + agg[m].f, 0);
    let acc = 0;
    for (const m of fk) {
      acc += agg[m].f;
      if (acc >= tot / 2) { out.speechMedian = m; break; }
    }
  }
  return out;
}

export interface RegisterTarget {
  lo: number;
  hi: number;
  colorVar: string;
}

export const REGISTER_TARGETS: Record<RegisterId, RegisterTarget> = {
  chest: { lo: 25, hi: 35, colorVar: '--cat1' },
  mixed: { lo: 25, hi: 35, colorVar: '--cat2' },
  falsetto: { lo: 15, hi: 25, colorVar: '--cat5' },
  speech: { lo: 10, hi: 20, colorVar: '--fala' },
};

export interface RegisterMix {
  totalVoiced: number;
  byRegister: Record<RegisterId, number>;
  percentages: Record<RegisterId, number>;
  warnings: string[];
  suggestedExerciseId: string | null;
}

export interface DatasetQuality {
  total: number;
  saved: number;
  failed: number;
  saving: number;
  qualityOk: number;
  qualityWarn: number;
  qualityBad: number;
  mixedSR: boolean;
  sampleRates: number[];
  empty: boolean;
  rehearsal: boolean;
  nextAction: 'record' | 'retry-save' | 'export';
}

export function datasetQuality(takes: Iterable<Take>, _settings: unknown): DatasetQuality {
  const list = [...takes];
  const saved = list.filter(t => t.saveStatus === 'saved').length;
  const failed = list.filter(t => t.saveStatus === 'failed').length;
  const saving = list.filter(t => t.saveStatus === 'saving').length;
  const qualityOk = list.filter(t => t.q === 'ok').length;
  const qualityWarn = list.filter(t => t.q === 'warn').length;
  const qualityBad = list.filter(t => t.q === 'bad').length;
  const srs = [...new Set(list.map(t => t.sr).filter((x): x is number => Boolean(x)))];
  const mixedSR = srs.length > 1;
  const empty = list.length === 0;
  const rehearsal = list.some(t => t.external);
  let nextAction: 'record' | 'retry-save' | 'export' = 'export';
  if (empty) nextAction = 'record';
  else if (failed > 0) nextAction = 'retry-save';
  return { total: list.length, saved, failed, saving, qualityOk, qualityWarn, qualityBad, mixedSR, sampleRates: srs, empty, rehearsal, nextAction };
}

export function registerMix(takes: Iterable<Take>, bank: Exercise[]): RegisterMix {
  const bankMap = new Map(bank.map(e => [e.id, e]));
  const byRegister: Record<RegisterId, number> = { chest: 0, mixed: 0, falsetto: 0, speech: 0 };
  let totalVoiced = 0;
  for (const t of takes) {
    const e = bankMap.get(t.id);
    if (!e) continue;
    const dur = t.voiced || t.dur || 0;
    byRegister[e.rg] += dur;
    totalVoiced += dur;
  }
  const percentages: Record<RegisterId, number> = {
    chest: totalVoiced ? (byRegister.chest / totalVoiced) * 100 : 0,
    mixed: totalVoiced ? (byRegister.mixed / totalVoiced) * 100 : 0,
    falsetto: totalVoiced ? (byRegister.falsetto / totalVoiced) * 100 : 0,
    speech: totalVoiced ? (byRegister.speech / totalVoiced) * 100 : 0,
  };
  const warnings: string[] = [];
  let suggestedExerciseId: string | null = null;
  if (totalVoiced >= 45) {
    if (percentages.mixed < REGISTER_TARGETS.mixed.lo) {
      warnings.push('coverage.mixWarnLowMixed');
      const ex = bank.find(e => e.rg === 'mixed');
      if (ex && !suggestedExerciseId) suggestedExerciseId = ex.id;
    }
    if (percentages.falsetto < REGISTER_TARGETS.falsetto.lo) {
      warnings.push('coverage.mixWarnLowFalsetto');
      const ex = bank.find(e => e.rg === 'falsetto');
      if (ex && !suggestedExerciseId) suggestedExerciseId = ex.id;
    }
    if (percentages.speech > REGISTER_TARGETS.speech.hi) {
      warnings.push('coverage.mixWarnHighSpeech');
    }
    if (percentages.chest > 55) {
      warnings.push('coverage.mixWarnHighChest');
    }
  }
  return { totalVoiced, byRegister, percentages, warnings, suggestedExerciseId };
}
