/**
 * Linear-interpolation resampling with anti-aliasing for downsampling.
 * When target SR >= source SR, no filtering is needed (safe upsampling).
 * When target SR < source SR, a simple moving-average anti-alias filter is applied.
 */
export function resamplePCM(x: Float32Array, fromSR: number, toSR: number): Float32Array {
  if (fromSR === toSR) return x;
  if (x.length === 0) return new Float32Array(0);

  const ratio = toSR / fromSR;
  const outLen = Math.max(1, Math.round(x.length * ratio));

  // For downsampling, apply a simple anti-alias filter before interpolation.
  // The filter cutoff is at the Nyquist of the target rate.
  let filtered = x;
  if (toSR < fromSR) {
    const cutoff = toSR / 2;
    // Simple first-order IIR lowpass with cutoff at target Nyquist
    // RC = 1 / (2 * pi * cutoff), alpha = dt / (RC + dt) where dt = 1/fromSR
    const dt = 1 / fromSR;
    const rc = 1 / (2 * Math.PI * cutoff);
    const alpha = dt / (rc + dt);
    filtered = new Float32Array(x.length);
    filtered[0] = x[0];
    for (let i = 1; i < x.length; i++) {
      filtered[i] = filtered[i - 1] + alpha * (x[i] - filtered[i - 1]);
    }
  }

  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcPos = i / ratio;
    const idx0 = Math.floor(srcPos);
    const idx1 = Math.min(idx0 + 1, filtered.length - 1);
    const frac = srcPos - idx0;
    // Clamp to valid range
    const i0 = Math.max(0, Math.min(idx0, filtered.length - 1));
    const i1 = Math.max(0, Math.min(idx1, filtered.length - 1));
    out[i] = filtered[i0] * (1 - frac) + filtered[i1] * frac;
  }
  return out;
}
