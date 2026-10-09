import { dB } from '../lib/music';

/** In-place iterative radix-2 FFT. `re.length` must be a power of two. */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang), h = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < h; j++) {
        const a = i + j, b = a + h;
        const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi;
        re[a] += xr; im[a] += xi;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}

export interface Ltas {
  /** Strongest local maximum between 2 and 4 kHz (the singer's presence region), Hz. */
  peakHz: number | null;
  /** Spectral centroid 80 Hz–8 kHz, Hz. */
  centroid: number;
  /** Energy 2–4 kHz relative to 0.3–2 kHz, dB. Depends on the microphone. */
  bright: number;
  /** [Hz, dB relative to the maximum] on a 1/24-octave grid. */
  ltas: [number, number][];
}

/**
 * Long-term average spectrum of the voiced parts of one or more recordings,
 * 4096-point Hann windows with 50 % overlap, 80 Hz–8 kHz.
 */
export function ltas(bufs: (Float32Array | undefined)[], sr: number, thrDb: number): Ltas | null {
  const L = 4096;
  const win = new Float64Array(L);
  for (let i = 0; i < L; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (L - 1));
  const acc = new Float64Array(L / 2);
  let frames = 0;
  for (const x of bufs) {
    if (!x) continue;
    for (let o = 0; o + L <= x.length; o += L / 2) {
      let s = 0;
      for (let i = 0; i < L; i++) s += x[o + i] * x[o + i];
      if (dB(Math.sqrt(s / L)) < thrDb + 6) continue;
      const re = new Float64Array(L), im = new Float64Array(L);
      for (let i = 0; i < L; i++) re[i] = x[o + i] * win[i];
      fft(re, im);
      for (let k = 0; k < L / 2; k++) acc[k] += re[k] * re[k] + im[k] * im[k];
      frames++;
    }
  }
  if (frames < 4) return null;
  const bin = sr / L;
  const pts: [number, number][] = [];
  for (let f = 80; f <= 8000; f *= Math.pow(2, 1 / 24)) {
    const lo = f / Math.pow(2, 1 / 12), hi = f * Math.pow(2, 1 / 12);
    let s = 0, c = 0;
    for (let k = Math.max(1, Math.floor(lo / bin)); k <= Math.ceil(hi / bin) && k < L / 2; k++) {
      const fk = k * bin;
      if (fk >= lo && fk <= hi) { s += acc[k]; c++; }
    }
    pts.push([f, 10 * Math.log10((c ? s / c : 1e-12) / frames + 1e-20)]);
  }
  const band = (a: number, b: number): number => {
    let s = 0;
    for (let k = 0; k < L / 2; k++) { const fk = k * bin; if (fk >= a && fk < b) s += acc[k]; }
    return s;
  };
  let pk: [number, number] | null = null;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    if (p[0] >= 2000 && p[0] <= 4000 && p[1] > pts[i - 1][1] && p[1] >= pts[i + 1][1] && (!pk || p[1] > pk[1])) pk = p;
  }
  let num = 0, den = 0;
  for (let k = 0; k < L / 2; k++) {
    const fk = k * bin;
    if (fk >= 80 && fk <= 8000) { num += fk * acc[k]; den += acc[k]; }
  }
  const mx = Math.max(...pts.map(p => p[1]));
  return {
    peakHz: pk ? pk[0] : null,
    centroid: num / den,
    bright: 10 * Math.log10(band(2000, 4000) / band(300, 2000)),
    ltas: pts.map(p => [Math.round(p[0]), +(p[1] - mx).toFixed(1)]),
  };
}
