import { describe, expect, it } from 'vitest';
import { decodeWav, encodeWav } from '../src/analysis/wav';
import { sine } from './signals';

describe('WAV encoding', () => {
  it('writes a valid 16-bit mono PCM header', () => {
    const b = encodeWav([sine(440, 0.01)], 48000, 16);
    const v = new DataView(b.buffer);
    const tag = (o: number) => String.fromCharCode(...b.subarray(o, o + 4));
    expect(tag(0)).toBe('RIFF');
    expect(tag(8)).toBe('WAVE');
    expect(tag(12)).toBe('fmt ');
    expect(tag(36)).toBe('data');
    expect(v.getUint16(20, true)).toBe(1); // PCM
    expect(v.getUint16(22, true)).toBe(1); // mono
    expect(v.getUint32(24, true)).toBe(48000);
    expect(v.getUint32(28, true)).toBe(96000);
    expect(v.getUint16(32, true)).toBe(2);
    expect(v.getUint16(34, true)).toBe(16);
    expect(v.getUint32(40, true)).toBe(480 * 2);
    expect(v.getUint32(4, true)).toBe(b.length - 8);
  });

  it.each([16, 24] as const)('round-trips %i-bit samples within quantization error', bits => {
    const x = sine(1000, 0.05, 0.9, 44100);
    const d = decodeWav(encodeWav([x], 44100, bits));
    expect(d.sr).toBe(44100);
    expect(d.bits).toBe(bits);
    expect(d.samples.length).toBe(x.length);
    const tol = bits === 16 ? 1 / 32767 : 1 / 8388607;
    let maxErr = 0;
    for (let i = 0; i < x.length; i++) maxErr = Math.max(maxErr, Math.abs(d.samples[i] - x[i]));
    expect(maxErr).toBeLessThanOrEqual(tol);
  });

  it('clamps overs to full scale instead of wrapping', () => {
    const d = decodeWav(encodeWav([Float32Array.from([1.5, -1.5, 0])], 48000, 24));
    expect(d.samples[0]).toBeCloseTo(1, 6);
    expect(d.samples[1]).toBeCloseTo(-1, 6);
  });

  it('joins clips with digital silence', () => {
    const a = Float32Array.from([0.5, 0.5]), b = Float32Array.from([-0.5]);
    const d = decodeWav(encodeWav([a, b], 10, 16, 0.3));
    expect(Array.from(d.samples).map(v => Math.round(v * 2) / 2)).toEqual([0.5, 0.5, 0, 0, 0, -0.5]);
  });
});
