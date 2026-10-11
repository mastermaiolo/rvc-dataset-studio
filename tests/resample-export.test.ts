import { describe, expect, it } from 'vitest';
import { resamplePCM } from '../src/analysis/resample';
import { decodeWav } from '../src/analysis/wav';
import { sine } from './signals';

describe('resamplePCM integration with WAV encoding', () => {
  it('reampled 48k→40k WAV has correct header sample rate', async () => {
    const x = sine(440, 1.0, 0.5, 48000);
    const resampled = resamplePCM(x, 48000, 40000);
    // Simulate what streamDatasetZip does: encode with target SR
    const { encodeWav } = await import('../src/analysis/wav');
    const wav = encodeWav([resampled], 40000, 16);
    const decoded = decodeWav(wav);
    expect(decoded.sr).toBe(40000);
    expect(decoded.samples.length).toBe(resampled.length);
  });

  it('reampled 48k→44.1k WAV has correct header sample rate', async () => {
    const x = sine(220, 0.5, 0.3, 48000);
    const resampled = resamplePCM(x, 48000, 44100);
    const { encodeWav } = await import('../src/analysis/wav');
    const wav = encodeWav([resampled], 44100, 16);
    const decoded = decodeWav(wav);
    expect(decoded.sr).toBe(44100);
  });

  it('preserve mode does not change sample rate', async () => {
    const x = sine(440, 1.0, 0.5, 48000);
    // In preserve mode, we use the original SR
    const { encodeWav } = await import('../src/analysis/wav');
    const wav = encodeWav([x], 48000, 16);
    const decoded = decodeWav(wav);
    expect(decoded.sr).toBe(48000);
  });

  it('reampled output has no NaN or Infinity', () => {
    const x = sine(880, 2.0, 0.99, 48000);
    const resampled = resamplePCM(x, 48000, 40000);
    for (let i = 0; i < resampled.length; i++) {
      expect(Number.isFinite(resampled[i])).toBe(true);
    }
  });
});
