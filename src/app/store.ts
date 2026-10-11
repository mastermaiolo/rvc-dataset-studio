import { computed, effect, signal } from '@preact/signals';
import coreBank from '../../content/bank/core.json';
import type { Take } from '../analysis/qc';
import { bankSpan, toneBase, transposition } from '../bank/calibrate';
import { compileBank, nominalMinutes } from '../bank/compile';
import type { Exercise, LText, RawBank, RawLangPack } from '../bank/types';
import { locale, lt, t, tip, type MessageKey } from '../i18n';
import { loadLyrics, lyricsBank, saveLyrics, type LyricLabels, type LyricLine } from '../lyrics/generate';
import { loadSettings, saveSettings, type Settings } from '../storage/settings';

/* ---------------- persisted settings ---------------- */

export const settings = signal<Settings>(loadSettings());
effect(() => saveSettings(settings.value));

export function update(patch: Partial<Settings>): void {
  settings.value = { ...settings.value, ...patch };
}

/** The user's own lyric lines — kept only in this browser. */
export const lyrics = signal<LyricLine[]>(loadLyrics());
effect(() => saveLyrics(lyrics.value));

/* ---------------- content ---------------- */

/** Every folder in content/langs/ is picked up automatically: adding a language is adding a folder. */
const packModules = import.meta.glob('../../content/langs/*/pack.json', { eager: true, import: 'default' });
export const PACKS: RawLangPack[] = Object.values(packModules as Record<string, RawLangPack>).sort((a, b) => a.id.localeCompare(b.id));
const CORE = coreBank as unknown as RawBank;

/** Pack for a UI locale (pt-BR → pt-BR, pt-PT → pt-BR, fr → en…). */
export function packForLocale(l: string): string {
  return (PACKS.find(p => p.id === l) ?? PACKS.find(p => p.id.split('-')[0] === l.split('-')[0]) ?? PACKS.find(p => p.id === 'en') ?? PACKS[0]).id;
}
/** Speech languages in use: the saved choice, or the interface language's pack. */
export const packs = computed(() => {
  const chosen = settings.value.packs?.filter(id => PACKS.some(p => p.id === id));
  return chosen && chosen.length ? chosen : [packForLocale(locale.value)];
});
const activePacks = computed(() => PACKS.filter(p => packs.value.includes(p.id)));
export const voiceTestText = computed(() => activePacks.value.find(p => p.voiceTest)?.voiceTest?.speech ?? PACKS.find(p => p.voiceTest)?.voiceTest?.speech ?? '');

/** Coaching tip for an exercise: the pack's own tip first, then the built-in one. */
export function tipFor(ex: Exercise): string {
  const own = PACKS.find(p => p.id === ex.source)?.tips?.[ex.tip];
  return own ? lt(own) : tip(ex.tip);
}

const here = (k: MessageKey): LText => ({ [locale.value]: t(k) });
const lyricLabels = (): LyricLabels => ({
  speech: here('lyrics.emo.speech'),
  fast: here('lyrics.emo.fast'),
  slow: here('lyrics.emo.slow'),
  sung: here('lyrics.emo.sung'),
  subSpeech: here('lyrics.sub.speech'),
  subFast: here('lyrics.sub.fast'),
  subSlow: here('lyrics.sub.slow'),
  subSung: here('lyrics.sub.sung'),
  regSpeech: here('lyrics.reg.speech'),
  regSung: here('lyrics.reg.sung'),
  tagSpeech: here('lyrics.tag.speech'),
  tagFast: here('lyrics.tag.fast'),
  tagSlow: here('lyrics.tag.slow'),
});

/** The session bank, placed in the singer's comfortable range. Recompiles when the range or lyrics change. */
export const bank = computed(() => {
  const S = settings.value;
  const ctx = { low: S.range.low, high: S.range.high, toneBase: toneBase(S.range, S.profile?.speech) };
  return compileBank([CORE, ...activePacks.value, lyricsBank(lyrics.value, lyricLabels())], ctx);
});
export const nominal = computed(() => nominalMinutes(bank.value));

/* ---------------- derived ---------------- */

export const tr = computed(() => transposition(settings.value));
export const idx = computed(() => {
  const i = bank.value.findIndex(e => e.id === settings.value.cur);
  return i < 0 ? 0 : i;
});
export const current = computed(() => bank.value[idx.value]);
export const span = computed(() => bankSpan(bank.value, tr.value));

/* ---------------- session state ---------------- */

export type Phase = 'idle' | 'prep' | 'rec' | 'review';
export const phase = signal<Phase>('idle');
/** Take waiting for accept/redo. */
export const pending = signal<Take | null>(null);
/** Accepted takes by key (pass:id). Replace the Map to notify. */
export const takes = signal<Map<string, Take>>(new Map());

export type MicState = { status: 'off' | 'ready' | 'blocked'; error?: string; forced?: string[] };
export const mic = signal<MicState>({ status: 'off' });
export const refPlaying = signal(false);
export const playing = signal(false);
export const dbOk = signal(false);
/** Countdown number shown during the count-in. */
export const countN = signal<number | null>(null);

export type DiagState = { i: number; phase: 'prep' | 'rec' | 'done'; startIn: number; left: number; progress: number } | null;
export const diag = signal<DiagState>(null);
export const diagMsg = signal('');

export const noise = signal<{ busy: boolean; count: number; error?: string }>({ busy: false, count: 0 });

export interface MicCheckState {
  status: 'idle' | 'measuring' | 'done';
  count: number;
  peakDb: number | null;
  rmsDb: number | null;
  clipped: boolean;
  verdict: 'clipping' | 'optimal' | 'acceptable' | 'low' | null;
  error?: string;
}
export const micCheck = signal<MicCheckState>({
  status: 'idle',
  count: 5,
  peakDb: null,
  rmsDb: null,
  clipped: false,
  verdict: null,
});

export const toastMsg = signal<{ text: string; id: number } | null>(null);
let toastId = 0;
export function toast(text: string): void {
  toastMsg.value = { text, id: ++toastId };
}

export interface ExportState {
  active: boolean;
  current: number;
  total: number;
  currentFile: string;
  percent: number;
}
export const exportProgress = signal<ExportState>({
  active: false,
  current: 0,
  total: 0,
  currentFile: '',
  percent: 0,
});

/** Files skipped in the last session WAV export (sample rate mismatch). */
export const sessionSkipped = signal<string[]>([]);

/* ---------------- totals ---------------- */

export const totals = computed(() => {
  let v = 0, ext = false;
  const byCat: Record<string, number> = {};
  const byId = new Map(bank.value.map(e => [e.id, e]));
  for (const t of takes.value.values()) {
    v += t.voiced;
    const ex = byId.get(t.id);
    if (ex) byCat[ex.cat] = (byCat[ex.cat] ?? 0) + t.voiced;
    if (t.external) ext = true;
  }
  return { v, byCat, ext };
});
