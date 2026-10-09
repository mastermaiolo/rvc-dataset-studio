import { dB, hzToMidi } from '../lib/music';

/** Box-filter decimation by an integer factor (cheap anti-alias for pitch detection). */
export function downsample(x: Float32Array, k: number): Float32Array {
  if (k <= 1) return x;
  const n = Math.floor(x.length / k);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < k; j++) s += x[i * k + j];
    out[i] = s / k;
  }
  return out;
}

/**
 * YIN fundamental-frequency estimator (de Cheveigné & Kawahara, 2002).
 * Returns the frequency in Hz, or null when no period is clear enough.
 */
export function yin(buf: Float32Array, sr: number, fmin = 60, fmax = 1100, threshold = 0.13): number | null {
  const n = buf.length;
  const maxTau = Math.min(Math.floor(sr / fmin), Math.floor(n / 2));
  const minTau = Math.max(2, Math.floor(sr / fmax));
  const d = new Float32Array(maxTau + 2);
  const w = n - maxTau - 1;
  if (w <= 0) return null;
  for (let tau = 1; tau <= maxTau + 1 && tau < n; tau++) {
    let s = 0;
    for (let i = 0; i < w; i++) {
      const v = buf[i] - buf[i + tau];
      s += v * v;
    }
    d[tau] = s;
  }
  // cumulative mean normalized difference
  let running = 0;
  d[0] = 1;
  for (let tau = 1; tau <= maxTau + 1; tau++) {
    running += d[tau];
    d[tau] = running > 0 ? (d[tau] * tau) / running : 1;
  }
  let tau = -1;
  for (let t = minTau; t <= maxTau; t++) {
    if (d[t] < threshold) {
      while (t + 1 <= maxTau && d[t + 1] < d[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) return null;
  // parabolic interpolation around the minimum
  const x0 = d[tau - 1], x1 = d[tau], x2 = d[tau + 1];
  const den = x0 + x2 - 2 * x1;
  const shift = den ? (x0 - x2) / (2 * den) : 0;
  return sr / (tau + (Math.abs(shift) < 1 ? shift : 0));
}

export interface PitchTrack {
  /** MIDI values (fractional) of every voiced analysis frame. */
  ms: number[];
  /** Seconds represented by each frame (hop size). */
  frame: number;
}

/** Frame-by-frame pitch track of a recording; frames quieter than `thrDb + 6` are skipped. */
export function pitchTrack(pcm: Float32Array, sr: number, thrDb: number): PitchTrack {
  const k = Math.max(1, Math.round(sr / 24000));
  const ds = downsample(pcm, k);
  const dsr = sr / k;
  const W = 1024, H = 512;
  const ms: number[] = [];
  for (let i = 0; i + W <= ds.length; i += H) {
    const fr = ds.subarray(i, i + W);
    let s = 0;
    for (let j = 0; j < W; j++) s += fr[j] * fr[j];
    if (dB(Math.sqrt(s / W)) < thrDb + 6) continue;
    const f = yin(fr, dsr);
    if (f) ms.push(hzToMidi(f));
  }
  return { ms, frame: H / dsr };
}
