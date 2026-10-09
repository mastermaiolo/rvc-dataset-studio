import { dB } from '../lib/music';

/** Hop used for level analysis and voice-activity detection (seconds). */
export const VAD_HOP = 0.02;

export interface LevelFrames {
  /** RMS level of each 20 ms frame, dBFS. */
  fdb: Float32Array;
  /** Absolute sample peak (linear). */
  peak: number;
  hop: number;
}

export function frameLevels(raw: Float32Array, sr: number, hopSec = VAD_HOP): LevelFrames {
  const hop = Math.max(1, Math.round(sr * hopSec));
  const nF = Math.floor(raw.length / hop);
  const fdb = new Float32Array(nF);
  let peak = 0;
  for (let f = 0; f < nF; f++) {
    let s = 0;
    for (let i = f * hop; i < (f + 1) * hop; i++) {
      const x = raw[i];
      s += x * x;
      const a = x < 0 ? -x : x;
      if (a > peak) peak = a;
    }
    fdb[f] = dB(Math.sqrt(s / hop));
  }
  return { fdb, peak, hop };
}

export interface VoiceActivity {
  /** Index of the first and last frame above threshold, -1 when silent. */
  first: number;
  last: number;
  /** Seconds of frames above threshold. */
  voiced: number;
  /**
   * Background noise, dBFS: median level of the frames below the threshold.
   * null when the take has almost no silence to measure (under 0.2 s).
   */
  floorDb: number | null;
}

export function voiceActivity(fdb: Float32Array, thrDb: number, hopSec = VAD_HOP): VoiceActivity {
  let first = -1, last = -1, vf = 0;
  for (let f = 0; f < fdb.length; f++) {
    if (fdb[f] > thrDb) {
      vf++;
      if (first < 0) first = f;
      last = f;
    }
  }
  const quiet = Array.from(fdb).filter(d => d <= thrDb).sort((a, b) => a - b);
  const floorDb = quiet.length * hopSec >= 0.2 ? quiet[Math.floor(quiet.length / 2)] : null;
  return { first, last, voiced: vf * hopSec, floorDb };
}

/**
 * Effective voice-activity threshold: the user setting, raised to 10 dB above
 * the measured noise floor when the room is noisier than the setting assumes.
 */
export function vadThreshold(settingDb: number, noiseDb: number | null): number {
  return noiseDb != null ? Math.max(settingDb, noiseDb + 10) : settingDb;
}

/**
 * Cuts silence at both ends, keeping 160 ms before and 200 ms after the voice,
 * with an 8 ms fade so the cut never clicks.
 */
export function trimSilence(raw: Float32Array, sr: number, va: VoiceActivity, hop: number): Float32Array {
  if (va.first < 0) return raw;
  const a = Math.max(0, (va.first - 8) * hop);
  const b = Math.min(raw.length, (va.last + 10) * hop);
  const pcm = raw.slice(a, b);
  const fl = Math.min(Math.round(sr * 0.008), Math.floor(pcm.length / 2));
  for (let i = 0; i < fl; i++) {
    const g = i / fl;
    pcm[i] *= g;
    pcm[pcm.length - 1 - i] *= g;
  }
  return pcm;
}

/** Number of samples at (or beyond) digital full scale. */
export function countClipped(pcm: Float32Array, limit = 0.995): number {
  let n = 0;
  for (let i = 0; i < pcm.length; i++) if (pcm[i] >= limit || pcm[i] <= -limit) n++;
  return n;
}

export function rmsDb(x: Float32Array): number {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i] * x[i];
  return dB(Math.sqrt(s / Math.max(1, x.length)));
}
