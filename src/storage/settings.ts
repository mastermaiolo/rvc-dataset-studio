import type { VocalProfile } from '../analysis/profile';
import { ASSUMED_RANGE } from '../analysis/profile';
import { MIN_SPAN, PASS_OFFSETS, VOICE_PRESETS, type Range } from '../bank/calibrate';
import type { BitDepth } from '../analysis/wav';

export interface Settings {
  /** The first-run flow (consent + range) was completed. */
  onboarded: boolean;
  /** The user confirmed they will only record their own voice or one they are authorized to use. */
  consent: boolean;
  goal: number;
  transpose: number;
  pass: number;
  bits: BitDepth;
  vad: number;
  trim: boolean;
  advance: boolean;
  preroll: boolean;
  guide: boolean;
  vol: number;
  muted: boolean;
  /** Id of the current exercise. */
  cur: string | null;
  noiseDb: number | null;
  range: Range;
  profile: VocalProfile | null;
  /** Speech-language packs in the bank; null = follow the interface language. */
  packs: string[] | null;
}

export const DEFAULTS: Settings = {
  onboarded: false,
  consent: false,
  goal: 12,
  transpose: 0,
  pass: 1,
  bits: 16,
  vad: -42,
  trim: true,
  advance: true,
  preroll: true,
  guide: false,
  vol: 0.6,
  muted: false,
  cur: null,
  noiseDb: null,
  range: { ...ASSUMED_RANGE, src: 'assumed' },
  profile: null,
  packs: null,
};

const KEY = 'rvcds.settings.v1';

/** Merges stored values over the defaults and repairs anything out of range. */
export function sanitize(raw: unknown): Settings {
  const s = { ...DEFAULTS, ...(raw && typeof raw === 'object' ? (raw as Partial<Settings>) : {}) } as Settings & Record<string, unknown>;
  delete s.voice;
  delete s.customOff;
  s.onboarded = !!s.onboarded;
  s.consent = !!s.consent;
  if (!Array.isArray(s.packs) || !s.packs.every(x => typeof x === 'string')) s.packs = null;
  if (!(s.pass in PASS_OFFSETS)) s.pass = 1;
  if (s.bits !== 16 && s.bits !== 24) s.bits = 16;
  s.goal = Math.max(5, Math.min(30, Number(s.goal) || 12));
  s.transpose = Math.max(-6, Math.min(6, Math.round(Number(s.transpose) || 0)));
  s.vad = Math.max(-60, Math.min(-25, Number(s.vad) || -42));
  s.vol = Math.max(0, Math.min(1, Number(s.vol)));
  if (!Number.isFinite(s.vol)) s.vol = 0.6;
  if (!s.range || typeof s.range.low !== 'number' || typeof s.range.high !== 'number' || s.range.high - s.range.low < MIN_SPAN) s.range = { ...DEFAULTS.range };
  if (!['assumed', 'preset', 'measured', 'manual'].includes(s.range.src)) s.range = { ...s.range, src: 'manual' };
  if (s.range.src === 'preset' && !(s.range.preset && s.range.preset in VOICE_PRESETS)) s.range = { ...s.range, src: 'manual', preset: undefined };
  return s;
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return sanitize(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}
