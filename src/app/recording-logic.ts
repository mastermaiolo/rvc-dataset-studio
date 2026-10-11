/**
 * Pure recording logic — no browser APIs, no DOM, no AudioContext.
 * All functions are deterministic and testable with Vitest.
 */

import type { Exercise } from '../bank/types';
import type { Take } from '../analysis/qc';
import { dB } from '../lib/music';

// ── Types ──────────────────────────────────────────────────────────────

export interface RecordingState {
  micStatus: 'off' | 'ready' | 'blocked';
  isRunning: boolean;
  isStopping: boolean;
  isMeasuring: boolean;
  isDiagActive: boolean;
}

export interface TakeAnalysis {
  pcm: Float32Array;
  sr: number;
  dur: number;
  voiced: number;
  peakDb: number;
  clip: boolean;
  floorDb: number | null;
}

export interface RecordingDecision {
  canRecord: boolean;
  reason?: 'mic-off' | 'mic-blocked' | 'already-running' | 'stopping' | 'measuring' | 'diag-active';
}

export interface AcceptDecision {
  canAccept: boolean;
  reason?: 'no-pending' | 'running';
}

// ── Pure decision functions ────────────────────────────────────────────

export function canStartRecording(state: RecordingState): RecordingDecision {
  if (state.micStatus === 'off') return { canRecord: false, reason: 'mic-off' };
  if (state.micStatus === 'blocked') return { canRecord: false, reason: 'mic-blocked' };
  if (state.isRunning) return { canRecord: false, reason: 'already-running' };
  if (state.isStopping) return { canRecord: false, reason: 'stopping' };
  if (state.isMeasuring) return { canRecord: false, reason: 'measuring' };
  if (state.isDiagActive) return { canRecord: false, reason: 'diag-active' };
  return { canRecord: true };
}

export function canAcceptTake(pendingTake: Take | null, isRunning: boolean): AcceptDecision {
  if (!pendingTake) return { canAccept: false, reason: 'no-pending' };
  if (isRunning) return { canAccept: false, reason: 'running' };
  return { canAccept: true };
}

export function canRedo(isRunning: boolean, hasTake: boolean): boolean {
  return !isRunning && hasTake;
}

// ── Pure analysis functions ────────────────────────────────────────────

export function analyzeRawTake(raw: Float32Array, sr: number): TakeAnalysis {
  const dur = raw.length / sr;
  let peak = 0;
  let sumSq = 0;
  let voicedSamples = 0;
  let clipCount = 0;

  for (let i = 0; i < raw.length; i++) {
    const v = raw[i];
    const abs = Math.abs(v);
    if (abs > peak) peak = abs;
    sumSq += v * v;
    if (abs > 0.01) voicedSamples++;
    if (abs >= 0.99) clipCount++;
  }

  const voiced = voicedSamples / sr;
  const peakDb = dB(peak);
  const clip = clipCount > 3;
  const rms = Math.sqrt(sumSq / raw.length);
  const floorDb = rms > 0 ? dB(rms) : null;

  return { pcm: raw, sr, dur, voiced, peakDb, clip, floorDb };
}

export function shouldAutoStop(elapsed: number, exerciseDuration: number, tail: number): boolean {
  return elapsed >= exerciseDuration + tail;
}

export function shouldStartCapture(elapsed: number): boolean {
  return elapsed >= -0.3 && elapsed < 0;
}

export function getCountdownNumber(elapsed: number): number | null {
  if (elapsed < 0) return Math.ceil(-elapsed);
  return null;
}

// ── Take factory ────────────────────────────────────────────────────────

export function createTakeFromRaw(
  raw: Float32Array,
  sr: number,
  exercise: Exercise,
  pass: number,
  exerciseIndex: number,
  transposition: number,
): Take {
  const analysis = analyzeRawTake(raw, sr);
  return {
    key: `${pass}:${exercise.id}`,
    id: exercise.id,
    n: exerciseIndex,
    pass,
    ts: Date.now(),
    pcm: analysis.pcm,
    sr: analysis.sr,
    dur: analysis.dur,
    voiced: analysis.voiced,
    peakDb: analysis.peakDb,
    clip: analysis.clip,
    floorDb: analysis.floorDb,
    tr: transposition,
  };
}

export function createRehearsalTake(
  exercise: Exercise,
  pass: number,
  exerciseIndex: number,
): Take {
  return {
    key: `${pass}:${exercise.id}`,
    id: exercise.id,
    n: exerciseIndex,
    pass,
    ts: Date.now(),
    external: true,
    rehearsal: true,
    dur: exercise.dur,
    voiced: exercise.dur,
  };
}
