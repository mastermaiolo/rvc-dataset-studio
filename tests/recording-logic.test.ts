import { describe, expect, it } from 'vitest';
import {
  canStartRecording,
  canAcceptTake,
  canRedo,
  analyzeRawTake,
  shouldAutoStop,
  shouldStartCapture,
  getCountdownNumber,
  createTakeFromRaw,
  createRehearsalTake,
  type RecordingState,
} from '../src/app/recording-logic';
import { sine, silence } from './signals';

const baseState: RecordingState = {
  micStatus: 'ready',
  isRunning: false,
  isStopping: false,
  isMeasuring: false,
  isDiagActive: false,
};

describe('canStartRecording', () => {
  it('allows recording when mic is ready and nothing is running', () => {
    expect(canStartRecording(baseState)).toEqual({ canRecord: true });
  });

  it('blocks when mic is off', () => {
    const r = canStartRecording({ ...baseState, micStatus: 'off' });
    expect(r.canRecord).toBe(false);
    expect(r.reason).toBe('mic-off');
  });

  it('blocks when mic is blocked', () => {
    const r = canStartRecording({ ...baseState, micStatus: 'blocked' });
    expect(r.canRecord).toBe(false);
    expect(r.reason).toBe('mic-blocked');
  });

  it('blocks when already running', () => {
    const r = canStartRecording({ ...baseState, isRunning: true });
    expect(r.canRecord).toBe(false);
    expect(r.reason).toBe('already-running');
  });

  it('blocks when stopping', () => {
    const r = canStartRecording({ ...baseState, isStopping: true });
    expect(r.canRecord).toBe(false);
    expect(r.reason).toBe('stopping');
  });

  it('blocks when measuring noise', () => {
    const r = canStartRecording({ ...baseState, isMeasuring: true });
    expect(r.canRecord).toBe(false);
    expect(r.reason).toBe('measuring');
  });

  it('blocks when diag is active', () => {
    const r = canStartRecording({ ...baseState, isDiagActive: true });
    expect(r.canRecord).toBe(false);
    expect(r.reason).toBe('diag-active');
  });
});

describe('canAcceptTake', () => {
  it('allows accepting when take exists and not running', () => {
    const take = createRehearsalTake({ id: 'e1', dur: 3 } as any, 1, 1);
    expect(canAcceptTake(take, false)).toEqual({ canAccept: true });
  });

  it('blocks when no pending take', () => {
    const r = canAcceptTake(null, false);
    expect(r.canAccept).toBe(false);
    expect(r.reason).toBe('no-pending');
  });

  it('blocks when recording is running', () => {
    const take = createRehearsalTake({ id: 'e1', dur: 3 } as any, 1, 1);
    const r = canAcceptTake(take, true);
    expect(r.canAccept).toBe(false);
    expect(r.reason).toBe('running');
  });
});

describe('canRedo', () => {
  it('allows redo when not running and take exists', () => {
    expect(canRedo(false, true)).toBe(true);
  });

  it('blocks redo when running', () => {
    expect(canRedo(true, true)).toBe(false);
  });

  it('blocks redo when no take', () => {
    expect(canRedo(false, false)).toBe(false);
  });
});

describe('analyzeRawTake', () => {
  it('measures duration correctly', () => {
    const sr = 48000;
    const x = sine(440, 1.0, 0.5, sr);
    const a = analyzeRawTake(x, sr);
    expect(a.dur).toBeCloseTo(1.0, 1);
  });

  it('detects clipping', () => {
    const sr = 48000;
    const x = sine(440, 0.5, 1.5, sr); // amplitude > 1
    const a = analyzeRawTake(x, sr);
    expect(a.clip).toBe(true);
  });

  it('does not flag clean signal as clipping', () => {
    const sr = 48000;
    const x = sine(440, 0.5, 0.5, sr);
    const a = analyzeRawTake(x, sr);
    expect(a.clip).toBe(false);
  });

  it('measures voiced time for sine wave', () => {
    const sr = 48000;
    const x = sine(440, 1.0, 0.5, sr);
    const a = analyzeRawTake(x, sr);
    expect(a.voiced).toBeGreaterThan(0.9);
  });

  it('measures low voiced time for silence', () => {
    const sr = 48000;
    const x = silence(1.0, sr);
    const a = analyzeRawTake(x, sr);
    expect(a.voiced).toBeLessThan(0.1);
  });

  it('calculates peak dB correctly', () => {
    const sr = 48000;
    const x = sine(440, 0.5, 0.5, sr);
    const a = analyzeRawTake(x, sr);
    expect(a.peakDb).toBeCloseTo(-6.0, 0); // 0.5 amplitude ≈ -6 dB
  });

  it('handles empty input', () => {
    const a = analyzeRawTake(new Float32Array(0), 48000);
    expect(a.dur).toBe(0);
    expect(a.peakDb).toBeLessThan(-80);
  });
});

describe('shouldAutoStop', () => {
  it('stops when elapsed exceeds duration + tail', () => {
    expect(shouldAutoStop(5.0, 4.0, 0.7)).toBe(true);
  });

  it('does not stop before duration + tail', () => {
    expect(shouldAutoStop(3.0, 4.0, 0.7)).toBe(false);
  });

  it('stops exactly at boundary', () => {
    expect(shouldAutoStop(4.7, 4.0, 0.7)).toBe(true);
  });
});

describe('shouldStartCapture', () => {
  it('starts capture just before recording begins', () => {
    expect(shouldStartCapture(-0.1)).toBe(true);
  });

  it('does not start too early', () => {
    expect(shouldStartCapture(-1.5)).toBe(false);
  });

  it('does not start after recording begins', () => {
    expect(shouldStartCapture(0.5)).toBe(false);
  });
});

describe('getCountdownNumber', () => {
  it('returns countdown number before recording', () => {
    expect(getCountdownNumber(-2.5)).toBe(3);
  });

  it('returns 1 just before start', () => {
    expect(getCountdownNumber(-0.5)).toBe(1);
  });

  it('returns null after recording starts', () => {
    expect(getCountdownNumber(0.5)).toBeNull();
  });
});

describe('createTakeFromRaw', () => {
  it('creates take with correct key', () => {
    const sr = 48000;
    const x = sine(440, 0.5, 0.5, sr);
    const ex = { id: 'e1', dur: 3 } as any;
    const take = createTakeFromRaw(x, sr, ex, 2, 5, 1);
    expect(take.key).toBe('2:e1');
    expect(take.pass).toBe(2);
    expect(take.n).toBe(5);
    expect(take.tr).toBe(1);
  });

  it('preserves PCM data', () => {
    const sr = 48000;
    const x = sine(440, 0.5, 0.5, sr);
    const ex = { id: 'e1', dur: 3 } as any;
    const take = createTakeFromRaw(x, sr, ex, 1, 1, 0);
    expect(take.pcm).toBe(x);
    expect(take.sr).toBe(sr);
  });
});

describe('createRehearsalTake', () => {
  it('creates external take without PCM', () => {
    const ex = { id: 'e1', dur: 3 } as any;
    const take = createRehearsalTake(ex, 1, 1);
    expect(take.external).toBe(true);
    expect(take.rehearsal).toBe(true);
    expect(take.pcm).toBeUndefined();
    expect(take.voiced).toBe(3);
  });

  it('uses exercise duration as voiced time', () => {
    const ex = { id: 'e1', dur: 5.5 } as any;
    const take = createRehearsalTake(ex, 1, 1);
    expect(take.dur).toBe(5.5);
    expect(take.voiced).toBe(5.5);
  });
});
