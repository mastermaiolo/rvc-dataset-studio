import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../src/audio/engine', () => ({
  engine: {
    micReady: true,
    capturing: false,
    startCapture: vi.fn(),
    stopCapture: vi.fn().mockResolvedValue(new Float32Array(0)),
    sampleRate: 48000,
    ensure: vi.fn(),
    initMic: vi.fn().mockResolvedValue({ ok: true }),
    onRefChange: null,
    onMicLost: null,
    now: 0,
    refPlaying: false,
    playReference: vi.fn(),
    stopReference: vi.fn(),
    play: vi.fn(),
    stopPlayback: vi.fn(),
    supported: true,
    info: null,
    ctx: null,
    analyser: null,
  },
}));

import { measureNoise, cancelNoise, runMicCheck, cancelMicCheck } from '../src/app/controller';
import { noise, micCheck, diag } from '../src/app/store';
import { engine } from '../src/audio/engine';

describe('measureNoise cancellation', () => {
  beforeEach(() => {
    noise.value = { busy: false, count: 0 };
    diag.value = null;
    vi.clearAllMocks();
  });

  it('restores noise state when cancelled mid-measurement', async () => {
    const promise = measureNoise();
    expect(noise.value.busy).toBe(true);
    expect(noise.value.count).toBe(3);

    cancelNoise();
    await promise;

    expect(noise.value.busy).toBe(false);
    expect(noise.value.count).toBe(0);
  });

  it('stops capture when cancelled mid-measurement', async () => {
    const promise = measureNoise();
    cancelNoise();
    await promise;
    expect(engine.stopCapture).toHaveBeenCalled();
  });

  it('is a no-op when no measurement is running', () => {
    cancelNoise();
    expect(noise.value.busy).toBe(false);
    expect(noise.value.count).toBe(0);
  });
});

describe('runMicCheck cancellation', () => {
  beforeEach(() => {
    noise.value = { busy: false, count: 0 };
    micCheck.value = { status: 'idle', count: 5, peakDb: null, rmsDb: null, clipped: false, verdict: null };
    diag.value = null;
    vi.clearAllMocks();
  });

  it('restores micCheck state when cancelled mid-measurement', async () => {
    const promise = runMicCheck();
    expect(micCheck.value.status).toBe('measuring');
    expect(micCheck.value.count).toBe(5);

    cancelMicCheck();
    await promise;

    expect(micCheck.value.status).toBe('idle');
    expect(micCheck.value.count).toBe(0);
  });

  it('stops capture when cancelled mid-measurement', async () => {
    const promise = runMicCheck();
    cancelMicCheck();
    await promise;
    expect(engine.stopCapture).toHaveBeenCalled();
  });

  it('is a no-op when no measurement is running', () => {
    cancelMicCheck();
    expect(micCheck.value.status).toBe('idle');
    expect(micCheck.value.count).toBe(5);
  });
});
