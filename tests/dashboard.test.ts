import { describe, expect, it } from 'vitest';
import { datasetQuality } from '../src/analysis/coverage';
import type { Take } from '../src/analysis/qc';
import type { Settings } from '../src/storage/settings';
import { sine } from './signals';

const baseSettings: Settings = {
  onboarded: true, consent: true, goal: 12, transpose: 0, pass: 1, bits: 16,
  vad: -42, trim: true, advance: true, preroll: true, guide: false, vol: 0.6,
  muted: false, cur: null, noiseDb: null, range: { low: 48, high: 72, src: 'assumed' },
  profile: null, packs: null, exportSR: 'preserve',
};

const mk = (n: number, sr: number, q: 'ok' | 'warn' | 'bad' = 'ok', saveStatus: 'saved' | 'failed' | 'saving' = 'saved'): Take => ({
  key: '1:e' + n, id: 'e' + n, n, pass: 1, ts: 0,
  pcm: sine(220, 0.2, 0.3, sr), sr, dur: 0.2, voiced: 0.2,
  q, saveStatus,
});

describe('datasetQuality', () => {
  it('counts takes by status', () => {
    const q = datasetQuality([mk(1, 48000, 'ok', 'saved'), mk(2, 48000, 'warn', 'failed'), mk(3, 48000, 'bad', 'saving')], baseSettings);
    expect(q.total).toBe(3);
    expect(q.saved).toBe(1);
    expect(q.failed).toBe(1);
    expect(q.saving).toBe(1);
  });

  it('counts quality distribution', () => {
    const q = datasetQuality([mk(1, 48000, 'ok'), mk(2, 48000, 'warn'), mk(3, 48000, 'bad')], baseSettings);
    expect(q.qualityOk).toBe(1);
    expect(q.qualityWarn).toBe(1);
    expect(q.qualityBad).toBe(1);
  });

  it('returns empty dataset warning when no takes', () => {
    const q = datasetQuality([], baseSettings);
    expect(q.empty).toBe(true);
  });

  it('detects mixed sample rates', () => {
    const q = datasetQuality([mk(1, 48000), mk(2, 44100)], baseSettings);
    expect(q.mixedSR).toBe(true);
    expect(q.sampleRates).toContain(48000);
    expect(q.sampleRates).toContain(44100);
  });

  it('detects consistent sample rates', () => {
    const q = datasetQuality([mk(1, 48000), mk(2, 48000)], baseSettings);
    expect(q.mixedSR).toBe(false);
  });

  it('returns next action when failed takes exist', () => {
    const q = datasetQuality([mk(1, 48000, 'ok', 'failed')], baseSettings);
    expect(q.nextAction).toBe('retry-save');
  });

  it('returns next action when dataset is empty', () => {
    const q = datasetQuality([], baseSettings);
    expect(q.nextAction).toBe('record');
  });

  it('returns next action when dataset is ready', () => {
    const q = datasetQuality([mk(1, 48000, 'ok'), mk(2, 48000, 'ok')], baseSettings);
    expect(q.nextAction).toBe('export');
  });

  it('returns rehearsal warning when external takes exist', () => {
    const ext: Take = { ...mk(1, 48000), external: true, rehearsal: true, pcm: undefined };
    const q = datasetQuality([ext], baseSettings);
    expect(q.rehearsal).toBe(true);
  });
});
