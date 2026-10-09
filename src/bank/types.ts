/** Types for the exercise bank as stored in content/*.json and as compiled for the app. */

export type Locale = string;
/** Localized display text keyed by BCP-47 locale. */
export type LText = Record<Locale, string>;

export const CATEGORIES = ['vowels', 'glides', 'speech', 'phonemes', 'dynamics', 'lyrics'] as const;
export type CategoryId = (typeof CATEGORIES)[number];

export type Mode = 'sustain' | 'glide' | 'melody' | 'speech' | 'drill' | 'tones';
export type ToneMark = 0 | 1 | 2 | 3 | 4 | 'h';
export type RegisterId = 'chest' | 'mixed' | 'falsetto' | 'speech';

interface RawBase {
  id: string;
  cat: CategoryId;
  dur: number;
  tip: string;
  rg?: RegisterId;
  reg?: LText;
  emo?: LText;
  sub?: LText;
  title?: LText;
}
export type RawExercise = RawBase &
  (
    | { mode: 'sustain'; pos: number; vowel: string; pre?: string }
    | { mode: 'sustain'; pos: number; vowels: string[] }
    | { mode: 'glide'; vowel: string; pos: number; steps: number[] }
    | { mode: 'glide'; vowel: string; path: number[] }
    | { mode: 'melody'; pos: number; notes: ([string, number] | [string, number, number])[]; highlight?: boolean }
    | { mode: 'speech' | 'drill'; text: string }
    | { mode: 'tones'; syl: (string | [string, string, ToneMark])[] }
  );

export interface RawBank {
  id: string;
  /** Where the source comes from; user lyrics are never part of the published bank. */
  user?: boolean;
  version: number;
  exercises: RawExercise[];
}
export interface RawLangPack extends RawBank {
  name: LText;
  script: string;
  romanization?: string;
  voiceTest?: { speech: string };
  tips?: Record<string, LText>;
}

/** One syllable/word/token as shown on the teleprompter. */
export interface Syl {
  t: string;
  /** Weight in the timing schedule; 0 = not timed (separators). */
  w: number;
  /** Target pitches in MIDI, placed in the singer's range (before fine adjust/pass). One = steady, more = contour. */
  f?: number[];
  hi?: boolean;
  sep?: boolean;
  /** Emphasised word in speech. */
  em?: boolean;
  /** Hanzi shown above the pinyin. */
  zh?: string;
}

export interface SchedItem {
  i: number;
  t0: number;
  t1: number;
  f: number[] | null;
}

export interface Exercise {
  id: string;
  /** 1-based position in the compiled bank; used for file names. */
  n: number;
  source: string;
  cat: CategoryId;
  mode: Mode;
  dur: number;
  tip: string;
  rg: RegisterId;
  reg: LText;
  emo: LText;
  sub?: LText;
  /** Explicit localized title, or a language-neutral generated one. */
  title: LText | string;
  /** Note appended to explicit titles of sung exercises (e.g. "C3"), since the key depends on the singer. */
  titleNote?: string;
  join: string;
  syl: Syl[];
  sched: SchedItem[];
  pitched: boolean;
  /** Vowel code of sustain/glide exercises (for the vowel hint). */
  vowel?: string;
}
