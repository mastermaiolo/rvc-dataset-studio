import { describe, expect, it } from 'vitest';
import { unzipSync } from 'fflate';
import { decodeWav } from '../src/analysis/wav';
import { streamDatasetZip } from '../src/export/dataset';
import type { Take } from '../src/analysis/qc';
import { sine } from './signals';

const mk = (n: number, sr: number): Take => ({
  key: '1:e' + n, id: 'e' + n, n, pass: 1, ts: 0,
  pcm: sine(220, 0.2, 0.3, sr), sr, dur: 0.2, voiced: 0.2,
});

async function extractZip(parts: Uint8Array[]): Promise<Record<string, Uint8Array>> {
  const buf = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) { buf.set(p, o); o += p.length; }
  return unzipSync(buf);
}

describe('streamDatasetZip with targetSR resampling', () => {
  it('preserves original sample rate when targetSR is undefined', async () => {
    const parts = await streamDatasetZip([mk(1, 48000), mk(2, 48000)], 16, 'readme');
    const files = await extractZip(parts);
    const w1 = decodeWav(files['rvc_dataset/voice_sample_001.wav']);
    const w2 = decodeWav(files['rvc_dataset/voice_sample_002.wav']);
    expect(w1.sr).toBe(48000);
    expect(w2.sr).toBe(48000);
  });

  it('resamples all takes to 40k when targetSR is 40000', async () => {
    const parts = await streamDatasetZip([mk(1, 48000), mk(2, 44100)], 16, 'readme', undefined, {
      targetSR: 40000,
    });
    const files = await extractZip(parts);
    const w1 = decodeWav(files['rvc_dataset/voice_sample_001.wav']);
    const w2 = decodeWav(files['rvc_dataset/voice_sample_002.wav']);
    expect(w1.sr).toBe(40000);
    expect(w2.sr).toBe(40000);
  });

  it('resamples all takes to 48k when targetSR is 48000', async () => {
    const parts = await streamDatasetZip([mk(1, 44100), mk(2, 40000)], 16, 'readme', undefined, {
      targetSR: 48000,
    });
    const files = await extractZip(parts);
    const w1 = decodeWav(files['rvc_dataset/voice_sample_001.wav']);
    const w2 = decodeWav(files['rvc_dataset/voice_sample_002.wav']);
    expect(w1.sr).toBe(48000);
    expect(w2.sr).toBe(48000);
  });

  it('resampled WAV has correct sample count for duration', async () => {
    const sr = 48000, dur = 0.2;
    const parts = await streamDatasetZip([mk(1, sr)], 16, 'readme', undefined, {
      targetSR: 40000,
    });
    const files = await extractZip(parts);
    const w = decodeWav(files['rvc_dataset/voice_sample_001.wav']);
    expect(w.sr).toBe(40000);
    expect(w.samples.length).toBe(Math.round(dur * 40000));
  });

  it('resampled output has no NaN', async () => {
    const parts = await streamDatasetZip([mk(1, 48000)], 16, 'readme', undefined, {
      targetSR: 40000,
    });
    const files = await extractZip(parts);
    const w = decodeWav(files['rvc_dataset/voice_sample_001.wav']);
    for (let i = 0; i < w.samples.length; i++) {
      expect(Number.isFinite(w.samples[i])).toBe(true);
    }
  });
});
