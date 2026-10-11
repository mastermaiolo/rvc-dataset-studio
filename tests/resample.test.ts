import { describe, expect, it } from 'vitest';
import { resamplePCM } from '../src/analysis/resample';
import { sine } from './signals';

describe('resamplePCM', () => {
  it('returns same buffer when sample rates match', () => {
    const x = sine(440, 0.1, 0.5, 48000);
    const out = resamplePCM(x, 48000, 48000);
    expect(out).toBe(x);
  });

  it('downsamples 48k to 44.1k preserving duration', () => {
    const dur = 1.0;
    const x = sine(440, dur, 0.5, 48000);
    const out = resamplePCM(x, 48000, 44100);
    expect(out.length).toBe(Math.round(dur * 44100));
    // no NaN
    for (let i = 0; i < out.length; i++) {
      expect(Number.isFinite(out[i])).toBe(true);
    }
  });

  it('downsamples 48k to 40k preserving duration', () => {
    const dur = 2.0;
    const x = sine(220, dur, 0.3, 48000);
    const out = resamplePCM(x, 48000, 40000);
    expect(out.length).toBe(Math.round(dur * 40000));
  });

  it('upsamples 44.1k to 48k preserving duration', () => {
    const dur = 0.5;
    const x = sine(880, dur, 0.5, 44100);
    const out = resamplePCM(x, 44100, 48000);
    expect(out.length).toBe(Math.round(dur * 48000));
  });

  it('produces no clipping above 1.0 after upsampling', () => {
    const x = sine(1000, 1.0, 0.99, 44100);
    const out = resamplePCM(x, 44100, 48000);
    let max = 0;
    for (let i = 0; i < out.length; i++) {
      const a = Math.abs(out[i]);
      if (a > max) max = a;
    }
    expect(max).toBeLessThanOrEqual(1.0);
  });

  it('preserves signal energy (RMS) within reasonable tolerance', () => {
    const x = sine(440, 1.0, 0.5, 48000);
    const rms = (arr: Float32Array) => {
      let s = 0;
      for (let i = 0; i < arr.length; i++) s += arr[i] * arr[i];
      return Math.sqrt(s / arr.length);
    };
    const rmsIn = rms(x);
    const out = resamplePCM(x, 48000, 40000);
    const rmsOut = rms(out);
    // RMS should be within 5% for a pure sine
    expect(Math.abs(rmsOut - rmsIn) / rmsIn).toBeLessThan(0.05);
  });

  it('handles empty input', () => {
    const out = resamplePCM(new Float32Array(0), 48000, 44100);
    expect(out.length).toBe(0);
  });

  it('handles single sample', () => {
    const x = new Float32Array([0.5]);
    const out = resamplePCM(x, 48000, 44100);
    expect(out.length).toBe(1);
    expect(out[0]).toBeCloseTo(0.5, 2);
  });
});
