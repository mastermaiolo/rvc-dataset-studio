/** Note names, MIDI ↔ Hz conversion and small number formatters shared by every module. */

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** "C3" → 48, "A4" → 69. Throws on malformed names so bad content fails loudly in tests. */
export function noteToMidi(name: string): number {
  const m = /^([A-G]#?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`Invalid note name: ${name}`);
  return NOTE_NAMES.indexOf(m[1] as (typeof NOTE_NAMES)[number]) + 12 * (Number(m[2]) + 1);
}

/** 48 → "C3". Fractional values are rounded to the nearest semitone. */
export function midiToNote(midi: number): string {
  const r = Math.round(midi);
  return NOTE_NAMES[((r % 12) + 12) % 12] + (Math.floor(r / 12) - 1);
}

export const midiToHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
export const hzToMidi = (f: number): number => 69 + 12 * Math.log2(f / 440);

export const dB = (x: number): number => 20 * Math.log10(Math.max(x, 1e-9));

export const pad3 = (n: number): string => String(n).padStart(3, '0');

export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

/** Typographic minus for negative numbers in the UI. */
export const minus = (s: string | number): string => String(s).replace('-', '−');

/** "+3", "−2", "±0" for semitone offsets. */
export const signed = (n: number): string => (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(n);

export const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));

/** Value at percentile p (0–1) of an unsorted array. */
export function percentile(a: ArrayLike<number>, p: number): number {
  const s = Array.from(a).sort((x, y) => x - y);
  return s[clamp(Math.floor(s.length * p), 0, s.length - 1)];
}

/** 5-point running median, used to clean octave jumps out of pitch tracks. */
export const median5 = (a: number[]): number[] =>
  a.map((_, i) => percentile(a.slice(Math.max(0, i - 2), i + 3), 0.5));

export function concatFloat32(chunks: Float32Array[]): Float32Array {
  let n = 0;
  for (const c of chunks) n += c.length;
  const out = new Float32Array(n);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

/** "+12¢", "−3¢", "±0¢" — rounds first so tiny negatives never show as "−0". */
export function signedCents(c: number): string {
  const r = Math.round(c);
  return (r > 0 ? '+' : r < 0 ? '−' : '±') + Math.abs(r) + '¢';
}
