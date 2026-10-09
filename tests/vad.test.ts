import { describe, expect, it } from 'vitest';
import { countClipped, frameLevels, rmsDb, trimSilence, vadThreshold, voiceActivity } from '../src/analysis/vad';
import { cat, noise, SR, sine, silence } from './signals';

describe('levels and voice activity', () => {
  it('measures RMS of a sine (amplitude 0.5 → −9.03 dBFS)', () => {
    expect(rmsDb(sine(440, 1, 0.5))).toBeCloseTo(-9.03, 1);
    const lv = frameLevels(sine(440, 1, 0.5), SR);
    expect(lv.peak).toBeCloseTo(0.5, 2);
    expect(lv.fdb[10]).toBeCloseTo(-9.03, 0);
  });

  it('counts only the voiced seconds and finds the noise floor', () => {
    const x = cat(noise(1, 0.001), sine(220, 2, 0.3), noise(1, 0.001, 9));
    const lv = frameLevels(x, SR);
    const va = voiceActivity(lv.fdb, -42);
    expect(va.voiced).toBeGreaterThan(1.95);
    expect(va.voiced).toBeLessThan(2.05);
    expect(va.floorDb).toBeLessThan(-60);
    expect(va.floorDb).toBeGreaterThan(-70);
  });

  it('reports no floor when the take has no silence to measure', () => {
    const lv = frameLevels(sine(220, 3, 0.3), SR);
    expect(voiceActivity(lv.fdb, -42).floorDb).toBeNull();
  });

  it('trims silence but keeps a short margin and fades the edges', () => {
    const x = cat(silence(1), sine(220, 2, 0.3), silence(1));
    const lv = frameLevels(x, SR);
    const va = voiceActivity(lv.fdb, -42);
    const y = trimSilence(x, SR, va, lv.hop);
    const sec = y.length / SR;
    expect(sec).toBeGreaterThan(2.2);
    expect(sec).toBeLessThan(2.5);
    expect(Math.abs(y[0])).toBe(0);
    expect(Math.abs(y[y.length - 1])).toBeLessThan(1e-3);
  });

  it('raises the threshold 10 dB above a noisy room', () => {
    expect(vadThreshold(-42, null)).toBe(-42);
    expect(vadThreshold(-42, -70)).toBe(-42);
    expect(vadThreshold(-42, -45)).toBe(-35);
  });

  it('detects clipping', () => {
    const x = sine(220, 0.1, 1.2).map(v => Math.max(-1, Math.min(1, v)));
    expect(countClipped(x)).toBeGreaterThan(3);
    expect(countClipped(sine(220, 0.1, 0.5))).toBe(0);
  });
});
