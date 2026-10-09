import { midiToNote, noteToMidi } from '../lib/music';
import { CATEGORIES, type Exercise, type RawBank, type RawExercise, type RegisterId, type Syl, type ToneMark } from './types';

/**
 * Mandarin tone contours in semitones above the speaking base pitch.
 * 'h' is the half third tone (low dip without the final rise) used before other tones.
 */
export const TONE_CONTOURS: Record<string, number[]> = {
  1: [8, 8],
  2: [3, 8],
  3: [3, 0, 6],
  h: [3, 0],
  4: [8, 0],
  0: [3, 3],
};

/** Where the bank is placed: the singer's comfortable range and the speaking base for tone contours. */
export interface PlaceContext {
  low: number;
  high: number;
  toneBase: number;
}

/** The range the original bank was written for (tenor C3–G4). Compiling with it reproduces the original notes. */
export const TENOR: PlaceContext = { low: noteToMidi('C3'), high: noteToMidi('G4'), toneBase: noteToMidi('C3') };

/** How far a sung exercise may leave the comfortable range: light touches up to 2 st above, 1 st below. Falsetto touches up to 7 st above. */
export const ABOVE = 2;
export const FALSETTO_ABOVE = 7;
export const BELOW = 1;

/** MIDI note at position p of the range (0 = low, 1 = high). */
export const atPos = (p: number, ctx: PlaceContext): number => ctx.low + Math.round(p * (ctx.high - ctx.low));

/**
 * Places a phrase: the first note at `pos`, the others by interval. If the phrase would leave
 * the allowed band it is moved as a whole (never distorted); if it is wider than the band, it is centred.
 */
export function place(pos: number, intervals: number[], ctx: PlaceContext, rg?: RegisterId): number[] {
  const root = atPos(pos, ctx);
  const ns = intervals.map(i => root + i);
  const maxAbove = rg === 'falsetto' ? FALSETTO_ABOVE : ABOVE;
  const hiLim = ctx.high + maxAbove, loLim = ctx.low - BELOW;
  const mx = Math.max(...ns), mn = Math.min(...ns);
  let shift = 0;
  if (mx - mn > hiLim - loLim) shift = Math.round((hiLim + loLim - mx - mn) / 2);
  else if (mx > hiLim) shift = hiLim - mx;
  else if (mn < loLim) shift = loLim - mn;
  return ns.map(n => n + shift);
}

const letters = (s: string): number => s.replace(/[^\p{L}']/gu, '').length;

function syllables(e: RawExercise, ctx: PlaceContext): { syl: Syl[]; join: string; title: string; titleNote?: string } {
  switch (e.mode) {
    case 'sustain': {
      const [note] = place(e.pos, [0], ctx, e.rg);
      const nn = midiToNote(note);
      if ('vowels' in e) {
        const syl: Syl[] = [];
        e.vowels.forEach((v, i) => {
          if (i) syl.push({ t: '→', w: 0, sep: true });
          syl.push({ t: v, hi: true, f: [note], w: 1 });
        });
        return { syl, join: ' ', title: e.vowels.join('→') + ' · ' + nn };
      }
      const syl: Syl[] = [];
      if (e.pre) syl.push({ t: e.pre, w: 0 });
      syl.push({ t: e.vowel, hi: true, f: [note], w: 1 });
      return { syl, join: '', title: (e.pre ?? '') + e.vowel[0] + ' · ' + nn };
    }
    case 'glide': {
      const f = 'path' in e ? e.path.map(p => atPos(p, ctx)) : place(e.pos, e.steps, ctx, e.rg);
      return { syl: [{ t: e.vowel, hi: true, f, w: 1 }], join: '', title: e.vowel[0] + ' ↝ ' + f.map(midiToNote).join('→') };
    }
    case 'melody': {
      const ns = place(e.pos, e.notes.map(n => n[1]), ctx, e.rg);
      return {
        syl: e.notes.map(([t, , w], i) => ({ t, hi: !!e.highlight, f: [ns[i]], w: w ?? 1 })),
        join: ' ',
        title: '“' + e.notes.map(p => p[0]).join(' ').replace(/- /g, '') + '”',
        titleNote: midiToNote(ns[0]),
      };
    }
    case 'speech': {
      const words = e.text.split(/\s+/).filter(Boolean);
      const syl = words.map(w => {
        const clean = w.replace(/\*/g, '');
        return { t: clean, em: /\*/.test(w), w: Math.max(2, letters(clean)) + (/[.,!?;:—。，！？]$/.test(clean) ? 3 : 0) };
      });
      return { syl, join: ' ', title: words.slice(0, 4).join(' ').replace(/\*/g, '').replace(/[,.!?]$/, '') + '…' };
    }
    case 'drill': {
      const parts = e.text.split(' · ');
      const syl: Syl[] = [];
      parts.forEach((p, i) => {
        if (i) syl.push({ t: '·', w: 0, sep: true });
        syl.push({ t: p, hi: true, w: Math.max(2, p.length) });
      });
      return { syl, join: ' ', title: parts.slice(0, 3).join(' ') };
    }
    case 'tones': {
      const syl = e.syl.map((it): Syl => {
        if (!Array.isArray(it)) return { t: it, w: 0, sep: true };
        const [py, hz, tone] = it as [string, string, ToneMark];
        return { t: py, zh: hz, f: TONE_CONTOURS[String(tone)].map(o => ctx.toneBase + o), w: tone === 0 ? 0.6 : 1, hi: true };
      });
      const title = e.syl
        .filter((i): i is [string, string, ToneMark] => Array.isArray(i))
        .slice(0, 5)
        .map(i => i[0])
        .join(' ');
      return { syl, join: ' ', title };
    }
  }
}

export function exerciseRegister(e: RawExercise): RegisterId {
  if (e.rg) return e.rg;
  if (e.mode === 'speech' || e.mode === 'drill' || e.mode === 'tones') return 'speech';
  const regStr = ((e.reg?.en || '') + ' ' + (e.reg?.['pt-BR'] || '')).toLowerCase();
  if (/falset/i.test(regStr)) return 'falsetto';
  if (/passag|passagem|mixed|mista|teto|top/i.test(regStr)) return 'mixed';
  if ('pos' in e && e.pos >= 0.75) return 'mixed';
  return 'chest';
}

/** Expands one raw exercise into the form the recorder uses, including its karaoke schedule. */
export function compileExercise(e: RawExercise, n: number, source: string, ctx: PlaceContext = TENOR): Exercise {
  const { syl, join, title, titleNote } = syllables(e, ctx);
  const timed = syl.filter(s => s.w > 0);
  const W = timed.reduce((a, s) => a + s.w, 0);
  let acc = 0;
  const sched: Exercise['sched'] = [];
  syl.forEach((s, j) => {
    if (s.w > 0) {
      const t0 = (acc / W) * e.dur;
      acc += s.w;
      sched.push({ i: j, t0, t1: (acc / W) * e.dur, f: s.f ?? null });
    }
  });
  return {
    id: e.id,
    n,
    source,
    cat: e.cat,
    mode: e.mode,
    dur: e.dur,
    tip: e.tip,
    rg: exerciseRegister(e),
    reg: e.reg ?? {},
    emo: e.emo ?? {},
    sub: e.sub,
    title: e.title ?? title,
    titleNote: e.title ? titleNote : undefined,
    join,
    syl,
    sched,
    pitched: syl.some(s => s.f),
    vowel: e.mode === 'sustain' && 'vowel' in e ? e.vowel : e.mode === 'glide' ? e.vowel : undefined,
  };
}

/**
 * Builds the session bank for a singer: exercises grouped by category (in CATEGORIES order),
 * and inside each category in source order (core bank, language packs, then the user's lyrics).
 */
export function compileBank(sources: RawBank[], ctx: PlaceContext = TENOR): Exercise[] {
  const out: Exercise[] = [];
  for (const cat of CATEGORIES) {
    for (const src of sources) {
      for (const e of src.exercises) if (e.cat === cat) out.push(compileExercise(e, out.length + 1, src.id, ctx));
    }
  }
  return out;
}

/** Total nominal minutes per category, used to split the duration goal. */
export function nominalMinutes(bank: Exercise[]): Record<string, number> {
  const r: Record<string, number> = {};
  for (const c of CATEGORIES) r[c] = bank.filter(e => e.cat === c).reduce((a, e) => a + e.dur, 0) / 60;
  return r;
}
