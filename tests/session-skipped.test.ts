import { describe, expect, it } from 'vitest';
import { sessionWav } from '../src/export/dataset';
import type { Take } from '../src/analysis/qc';
import { sine } from './signals';

const mk = (n: number, sr: number): Take => ({
  key: '1:e' + n, id: 'e' + n, n, pass: 1, ts: 0,
  pcm: sine(220, 0.2, 0.3, sr), sr, dur: 0.2, voiced: 0.2,
});

describe('sessionWav skippedFiles', () => {
  it('returns skipped files with names when takes have mixed sample rates', () => {
    const r = sessionWav([mk(1, 48000), mk(2, 44100), mk(3, 48000)], 16)!;
    expect(r.skipped).toBe(1);
    expect(r.skippedFiles).toEqual(['voice_sample_002.wav']);
  });

  it('returns empty skippedFiles when all takes share the same sample rate', () => {
    const r = sessionWav([mk(1, 48000), mk(2, 48000)], 16)!;
    expect(r.skipped).toBe(0);
    expect(r.skippedFiles).toEqual([]);
  });

  it('uses the first take sample rate as reference', () => {
    const r = sessionWav([mk(1, 44100), mk(2, 48000)], 16)!;
    expect(r.sampleRate).toBe(44100);
    expect(r.skippedFiles).toEqual(['voice_sample_002.wav']);
  });
});
