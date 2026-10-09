import { median5, noteToMidi, percentile } from '../lib/music';
import { ltas, type Ltas } from './spectrum';
import { pitchTrack } from './yin';

/** Typical comfortable ranges (MIDI) used only to say which voice type the siren is closest to. */
export const VOICE_TYPES: [id: string, low: number, high: number][] = [
  ['bass', 40, 64],
  ['baritone', 45, 69],
  ['tenor', 48, 72],
  ['alto', 53, 77],
  ['mezzo', 57, 81],
  ['soprano', 60, 84],
];

export type VoiceTestStep = 'siren' | 'speech' | 'sustain';
export const VOICE_TEST_STEPS: { k: VoiceTestStep; dur: number }[] = [
  { k: 'siren', dur: 14 },
  { k: 'speech', dur: 9 },
  { k: 'sustain', dur: 6 },
];

export interface VocalProfile extends Partial<Ltas> {
  date: number;
  sirenLow: number;
  sirenHigh: number;
  /** Estimated comfortable range: a semitone in from the bottom, two from the top. */
  low: number;
  high: number;
  speech?: number;
  speechSpan?: number;
  comfort?: number;
  /** Pitch wobble of the comfortable note, cents RMS. */
  stab?: number;
  /** The two closest voice types by extension. */
  types: string[];
}

export type VoiceTestResult = { ok: true; profile: VocalProfile } | { ok: false; reason: 'no-siren' | 'narrow-siren' };

/** A siren must cover at least this many semitones to estimate a usable range. */
export const MIN_SIREN_SPAN = 7;

export function analyzeVoiceTest(data: Partial<Record<VoiceTestStep, Float32Array>>, sr: number, thrDb: number): VoiceTestResult {
  const si = median5(data.siren ? pitchTrack(data.siren, sr, thrDb).ms : []);
  const spk = data.speech ? pitchTrack(data.speech, sr, thrDb).ms : [];
  const su = data.sustain ? pitchTrack(data.sustain, sr, thrDb).ms : [];
  if (si.length < 30) return { ok: false, reason: 'no-siren' };
  const sLow = percentile(si, 0.03), sHigh = percentile(si, 0.97);
  if (sHigh - sLow < MIN_SIREN_SPAN) return { ok: false, reason: 'narrow-siren' };
  const P: VocalProfile = { date: Date.now(), sirenLow: sLow, sirenHigh: sHigh, low: Math.round(sLow) + 1, high: Math.round(sHigh) - 2, types: [] };
  if (P.high - P.low < 7) { P.low = Math.round(sLow); P.high = Math.round(sHigh); }
  if (spk.length >= 20) {
    P.speech = percentile(spk, 0.5);
    P.speechSpan = percentile(spk, 0.9) - percentile(spk, 0.1);
  }
  if (su.length >= 20) {
    const mid = su.slice(Math.floor(su.length * 0.2), Math.ceil(su.length * 0.8));
    const m = percentile(mid, 0.5);
    P.comfort = m;
    P.stab = Math.sqrt(mid.reduce((a, x) => a + ((x - m) * 100) ** 2, 0) / mid.length);
  }
  const sp = ltas([data.speech, data.sustain], sr, thrDb);
  if (sp) Object.assign(P, sp);
  P.types = VOICE_TYPES.map(([n, L, H]) => ({ n, e: Math.abs(sLow - L) + Math.abs(sHigh - H) }))
    .sort((a, b) => a.e - b.e)
    .slice(0, 2)
    .map(x => x.n);
  return { ok: true, profile: P };
}

/** Assumed profile before any test: tenor, comfortable C3–G4. */
export const ASSUMED_RANGE = { low: noteToMidi('C3'), high: noteToMidi('G4') };
