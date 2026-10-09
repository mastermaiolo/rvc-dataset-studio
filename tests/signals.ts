/** Deterministic synthetic signals for analysis tests. */

export const SR = 48000;

/** Mulberry32 PRNG so noise is identical on every run. */
export function rng(seed = 1): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sine(freq: number, dur: number, amp = 0.5, sr = SR): Float32Array {
  const n = Math.round(dur * sr), x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = amp * Math.sin((2 * Math.PI * freq * i) / sr);
  return x;
}

/** Voice-like tone: fundamental plus decaying harmonics. */
export function voiced(freq: number, dur: number, amp = 0.4, sr = SR, harmonics = 8): Float32Array {
  const n = Math.round(dur * sr), x = new Float32Array(n);
  for (let h = 1; h <= harmonics; h++) {
    const a = amp / h / 1.8;
    for (let i = 0; i < n; i++) x[i] += a * Math.sin((2 * Math.PI * freq * h * i) / sr);
  }
  return x;
}

/** Exponential glide (constant semitones per second) from f0 to f1. */
export function glide(f0: number, f1: number, dur: number, amp = 0.4, sr = SR): Float32Array {
  const n = Math.round(dur * sr), x = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const f = f0 * Math.pow(f1 / f0, i / n);
    ph += (2 * Math.PI * f) / sr;
    x[i] = amp * (Math.sin(ph) + 0.4 * Math.sin(2 * ph) + 0.2 * Math.sin(3 * ph));
  }
  return x;
}

export function noise(dur: number, amp: number, seed = 7, sr = SR): Float32Array {
  const r = rng(seed), n = Math.round(dur * sr), x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = amp * (r() * 2 - 1);
  return x;
}

export const silence = (dur: number, sr = SR): Float32Array => new Float32Array(Math.round(dur * sr));

export function cat(...parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

export function mix(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(Math.max(a.length, b.length));
  for (let i = 0; i < out.length; i++) out[i] = (a[i] ?? 0) + (b[i] ?? 0);
  return out;
}
