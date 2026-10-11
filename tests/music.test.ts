import { describe, expect, it } from 'vitest';
import {
  noteToMidi, midiToNote, midiToHz, hzToMidi, dB, pad3, clock,
  NOTE_NAMES,
} from '../src/lib/music';

describe('noteToMidi', () => {
  it('converts C4 to 60', () => {
    expect(noteToMidi('C4')).toBe(60);
  });

  it('converts A4 to 69', () => {
    expect(noteToMidi('A4')).toBe(69);
  });

  it('converts C0 to 12', () => {
    expect(noteToMidi('C0')).toBe(12);
  });

  it('handles sharps', () => {
    expect(noteToMidi('C#4')).toBe(61);
    expect(noteToMidi('F#4')).toBe(66);
  });

  it('throws for flats (not supported)', () => {
    expect(() => noteToMidi('Bb4')).toThrow('Invalid note name');
  });
});

describe('midiToNote', () => {
  it('converts 60 to C4', () => {
    expect(midiToNote(60)).toBe('C4');
  });

  it('converts 69 to A4', () => {
    expect(midiToNote(69)).toBe('A4');
  });

  it('converts 0 to C-1', () => {
    expect(midiToNote(0)).toBe('C-1');
  });

  it('converts 127 to G9', () => {
    expect(midiToNote(127)).toBe('G9');
  });
});

describe('midiToHz', () => {
  it('converts A4 (69) to 440 Hz', () => {
    expect(midiToHz(69)).toBeCloseTo(440, 0);
  });

  it('converts C4 (60) to ~261.63 Hz', () => {
    expect(midiToHz(60)).toBeCloseTo(261.63, 1);
  });

  it('doubles frequency for each octave', () => {
    expect(midiToHz(81)).toBeCloseTo(880, 0);
  });
});

describe('hzToMidi', () => {
  it('converts 440 Hz to 69', () => {
    expect(hzToMidi(440)).toBeCloseTo(69, 1);
  });

  it('converts 220 Hz to 57', () => {
    expect(hzToMidi(220)).toBeCloseTo(57, 1);
  });

  it('is inverse of midiToHz', () => {
    for (const m of [40, 50, 60, 70, 80]) {
      expect(hzToMidi(midiToHz(m))).toBeCloseTo(m, 0);
    }
  });
});

describe('dB', () => {
  it('returns -Infinity for 0', () => {
    expect(dB(0)).toBeLessThan(-100);
  });

  it('returns 0 for amplitude 1', () => {
    expect(dB(1)).toBeCloseTo(0, 1);
  });

  it('returns -6 for amplitude 0.5', () => {
    expect(dB(0.5)).toBeCloseTo(-6.02, 1);
  });

  it('returns -20 for amplitude 0.1', () => {
    expect(dB(0.1)).toBeCloseTo(-20, 1);
  });
});

describe('pad3', () => {
  it('pads single digit', () => {
    expect(pad3(1)).toBe('001');
  });

  it('pads two digits', () => {
    expect(pad3(12)).toBe('012');
  });

  it('does not pad three digits', () => {
    expect(pad3(123)).toBe('123');
  });

  it('handles 0', () => {
    expect(pad3(0)).toBe('000');
  });
});

describe('clock', () => {
  it('formats seconds as mm:ss', () => {
    expect(clock(65)).toBe('01:05');
  });

  it('formats 0 as 00:00', () => {
    expect(clock(0)).toBe('00:00');
  });

  it('formats 59 as 00:59', () => {
    expect(clock(59)).toBe('00:59');
  });

  it('formats 600 as 10:00', () => {
    expect(clock(600)).toBe('10:00');
  });
});

describe('NOTE_NAMES', () => {
  it('has 12 notes', () => {
    expect(NOTE_NAMES.length).toBe(12);
  });

  it('starts with C', () => {
    expect(NOTE_NAMES[0]).toBe('C');
  });

  it('ends with B', () => {
    expect(NOTE_NAMES[11]).toBe('B');
  });
});
