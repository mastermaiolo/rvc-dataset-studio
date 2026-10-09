import { describe, expect, it } from 'vitest';
import { downsample, pitchTrack, yin } from '../src/analysis/yin';
import { hzToMidi, midiToHz, noteToMidi, percentile } from '../src/lib/music';
import { noise, SR, sine, silence, voiced } from './signals';

const frame = (x: Float32Array, k = 2) => downsample(x.subarray(0, 2048), k);

describe('YIN pitch detection', () => {
  it.each([82.41, 110, 196, 261.63, 440, 659.25, 880])('finds %f Hz within 0.3 %', f => {
    const got = yin(frame(sine(f, 0.1)), SR / 2);
    expect(got).not.toBeNull();
    expect(Math.abs(got! / f - 1)).toBeLessThan(0.003);
  });

  it('follows the fundamental of a harmonic-rich voice, not an overtone', () => {
    const f = 146.83; // D3
    const got = yin(frame(voiced(f, 0.1)), SR / 2)!;
    expect(Math.abs(hzToMidi(got) - hzToMidi(f))).toBeLessThan(0.1);
  });

  it('returns null for silence and white noise', () => {
    expect(yin(frame(silence(0.1)), SR / 2)).toBeNull();
    expect(yin(frame(noise(0.1, 0.3)), SR / 2)).toBeNull();
  });

  it('pitchTrack reports the note of a sustained tone and skips quiet frames', () => {
    const m = noteToMidi('A3');
    const tk = pitchTrack(voiced(midiToHz(m), 1.5), SR, -42);
    expect(tk.ms.length).toBeGreaterThan(50);
    expect(Math.abs(percentile(tk.ms, 0.5) - m)).toBeLessThan(0.05);
    expect(pitchTrack(silence(1), SR, -42).ms).toHaveLength(0);
  });

  it('works at 44.1 kHz as well (iOS / some interfaces)', () => {
    const tk = pitchTrack(voiced(220, 1, 0.4, 44100), 44100, -42);
    expect(Math.abs(percentile(tk.ms, 0.5) - hzToMidi(220))).toBeLessThan(0.05);
  });
});
