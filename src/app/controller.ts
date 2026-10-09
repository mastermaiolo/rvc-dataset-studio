import { batch } from '@preact/signals';
import { registerMix } from '../analysis/coverage';
import { analyzeVoiceTest, VOICE_TEST_STEPS, type VoiceTestStep } from '../analysis/profile';
import { analyzeTake, qcList, takeKey, worst, type Take } from '../analysis/qc';
import { rmsDb, vadThreshold } from '../analysis/vad';
import { engine } from '../audio/engine';
import { MIN_SPAN, presetRange, type VoiceId } from '../bank/calibrate';
import { parseLines } from '../lyrics/generate';
import type { LyricLang } from '../lyrics/syllables';
import type { Exercise } from '../bank/types';
import { datasetEntries, buildZip, download, sessionWav, sortTakes, takeFileName } from '../export/dataset';
import { locale, lt, num, t, tList, tn } from '../i18n';
import { dB, midiToNote, signed } from '../lib/music';
import { allTakes, clearTakes, dbAvailable, deleteTake, openDB, putTake, requestPersistence } from '../storage/idb';
import { resetKaraoke, runClock, startLiveLoop, updateHold, updateKaraoke } from './live';
import {
  bank, countN, current, packs, dbOk, diag, diagMsg, idx, lyrics, mic, micCheck, noise, pending, phase, playing, refPlaying,
  settings, takes, toast, totals, tr, update,
} from './store';

/** Count-in before the take starts, and extra recording after the nominal end (seconds). */
const PREP = 2.0;
const TAIL = 0.7;

interface Run {
  ex: Exercise;
  tRec: number;
  capturing: boolean;
  recStarted: boolean;
}
let run: Run | null = null;
let stopping = false;
let demo: { t0: number; ex: Exercise } | null = null;
let acceptedSinceBreak = 0;

export const isRunning = (): boolean => !!run;
const thr = () => vadThreshold(settings.value.vad, settings.value.noiseDb);
export const shownTake = (): Take | null => {
  const tk = pending.value ?? takes.value.get(takeKey(settings.value.pass, current.value.id)) ?? null;
  return tk && tk.n !== current.value.n ? { ...tk, n: current.value.n } : tk;
};

/* ---------------- microphone ---------------- */

export async function enableMic(): Promise<boolean> {
  if (engine.micReady) return true;
  try { engine.ensure(); } catch {
    mic.value = { status: 'blocked', error: 'unsupported' };
    return false;
  }
  const r = await engine.initMic();
  if (r.ok) {
    document.documentElement.dataset.capture = engine.info?.capture ?? '';
    mic.value = { status: 'ready', forced: engine.info?.forcedProcessing };
    return true;
  }
  mic.value = { status: 'blocked', error: r.error };
  return false;
}

/* ---------------- reference tone ---------------- */

export function stopRef(): void {
  engine.stopReference();
  if (demo) {
    demo = null;
    resetKaraoke(current.value);
  }
}

export function toggleTone(): void {
  const ex = current.value;
  if (!ex.pitched || run) return;
  engine.ensure();
  if (engine.refPlaying) { stopRef(); return; }
  const t0 = engine.now + 0.06;
  engine.playReference(ex, t0, tr.value);
  demo = { t0, ex };
  const tick = () => {
    if (!demo || run) return;
    const el = engine.now - demo.t0;
    if (el >= 0) { updateHold(el, demo.ex); updateKaraoke(el, demo.ex); }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ---------------- take playback ---------------- */

export function stopPlay(): void {
  engine.stopPlayback();
  playing.value = false;
}

export function togglePlay(): void {
  const tk = shownTake();
  if (!tk?.pcm || !tk.sr) return;
  if (playing.value) { stopPlay(); return; }
  engine.play(tk.pcm, tk.sr, () => { playing.value = false; });
  playing.value = true;
}

/* ---------------- recording flow ---------------- */

export async function recButton(): Promise<void> {
  try { engine.ensure(); } catch {}
  if (run) { await stopTake(); return; }
  if (stopping) return;
  if (mic.value.status === 'off') await enableMic();
  beginRun();
}

function beginRun(): void {
  if (noise.value.busy || diag.value || !engine.ctx) return;
  const ex = current.value;
  stopRef();
  stopPlay();
  const now = engine.now;
  run = { ex, tRec: now + PREP, capturing: false, recStarted: false };
  const S = settings.value;
  if (S.preroll && ex.pitched) engine.playReference(ex, now + 0.1, tr.value, { first: true, len: PREP - 0.35 });
  if (S.guide && ex.pitched) engine.playReference(ex, run.tRec, tr.value);
  batch(() => {
    pending.value = null;
    phase.value = 'prep';
    countN.value = Math.ceil(PREP);
  });
  resetKaraoke(ex);
  requestAnimationFrame(tick);
}

function tick(): void {
  const r = run;
  if (!r) return;
  const el = engine.now - r.tRec;
  if (!r.capturing && el >= -0.3 && engine.micReady) {
    engine.startCapture();
    r.capturing = true;
  }
  if (el < 0) countN.value = Math.ceil(-el);
  else {
    if (!r.recStarted) {
      r.recStarted = true;
      runClock.tRec = r.tRec;
      batch(() => { phase.value = 'rec'; countN.value = null; });
    }
    updateHold(el, r.ex);
    updateKaraoke(el, r.ex);
    if (el >= r.ex.dur + TAIL) { void stopTake(); return; }
  }
  requestAnimationFrame(tick);
}

async function cancelRun(): Promise<void> {
  const r = run;
  run = null;
  runClock.tRec = null;
  countN.value = null;
  if (r?.capturing) await engine.stopCapture();
}

export async function stopTake(): Promise<void> {
  const r = run;
  if (!r || stopping) return;
  stopping = true;
  run = null;
  runClock.tRec = null;
  stopRef();
  countN.value = null;
  try {
    if (!r.recStarted) {
      if (r.capturing) await engine.stopCapture();
      phase.value = 'idle';
      resetKaraoke(r.ex);
      return;
    }
    const base = { key: takeKey(settings.value.pass, r.ex.id), id: r.ex.id, n: r.ex.n, pass: settings.value.pass, ts: Date.now() };
    let tk: Take;
    if (r.capturing && engine.micReady) {
      const raw = await engine.stopCapture();
      tk = { ...base, ...analyzeTake(raw, engine.sampleRate, r.ex, { thrDb: thr(), trim: settings.value.trim, tr: tr.value }) };
    } else {
      tk = { ...base, external: true, rehearsal: true, dur: r.ex.dur, voiced: r.ex.dur };
    }
    batch(() => { pending.value = tk; phase.value = 'review'; });
  } finally {
    stopping = false;
  }
}

export async function accept(): Promise<void> {
  const tk = pending.value;
  if (!tk || run) return;
  tk.q = worst(qcList(tk));
  const next = new Map(takes.value);
  next.set(tk.key, tk);
  batch(() => {
    takes.value = next;
    pending.value = null;
    phase.value = 'idle';
  });
  if (++acceptedSinceBreak >= 15) {
    acceptedSinceBreak = 0;
    setTimeout(() => toast(t('toast.rest')), 400);
  }
  // advance before awaiting the save, so a quick Space after Enter records the next exercise
  if (settings.value.advance && idx.value < bank.value.length - 1) go(idx.value + 1);
  if (dbAvailable() && !(await putTake(tk))) toast(t('toast.saveFail'));
}

export function redo(): void {
  if (run) return;
  if (!shownTake()) return;
  batch(() => { pending.value = null; phase.value = 'idle'; });
  void recButton();
}

export function go(i: number): void {
  const B = bank.value;
  if (i < 0 || i >= B.length) return;
  if (run) void cancelRun();
  stopRef();
  stopPlay();
  batch(() => {
    pending.value = null;
    phase.value = 'idle';
    update({ cur: B[i].id });
  });
  resetKaraoke(B[i]);
}

export function setPass(pass: number): void {
  batch(() => {
    pending.value = null;
    phase.value = 'idle';
    update({ pass });
  });
}

/* ---------------- noise floor ---------------- */

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function measureNoise(): Promise<void> {
  if (run || noise.value.busy || diag.value) return;
  if (!engine.micReady && !(await enableMic())) {
    noise.value = { busy: false, count: 0, error: 'needMic' };
    return;
  }
  noise.value = { busy: true, count: 3 };
  engine.startCapture();
  for (let i = 3; i > 0; i--) {
    noise.value = { busy: true, count: i };
    await sleep(1000);
  }
  const x = await engine.stopCapture();
  update({ noiseDb: Math.round(rmsDb(x)) });
  noise.value = { busy: false, count: 0 };
}

export async function runMicCheck(): Promise<void> {
  if (run || noise.value.busy || diag.value || micCheck.value.status === 'measuring') return;
  if (!engine.micReady && !(await enableMic())) {
    micCheck.value = { ...micCheck.value, status: 'idle', error: 'needMic' };
    return;
  }
  micCheck.value = { status: 'measuring', count: 5, peakDb: null, rmsDb: null, clipped: false, verdict: null, error: undefined };
  engine.startCapture();
  for (let i = 5; i > 0; i--) {
    micCheck.value = { ...micCheck.value, count: i };
    await sleep(1000);
  }
  const x = await engine.stopCapture();
  let maxAbs = 0;
  for (let i = 0; i < x.length; i++) {
    const v = Math.abs(x[i]);
    if (v > maxAbs) maxAbs = v;
  }
  const peakDb = dB(maxAbs);
  const rms = rmsDb(x);
  const clipped = maxAbs >= 0.99 || peakDb >= -0.5;
  let verdict: 'clipping' | 'optimal' | 'acceptable' | 'low';
  if (clipped || peakDb > -1) {
    verdict = 'clipping';
  } else if (peakDb >= -14 && peakDb <= -4) {
    verdict = 'optimal';
  } else if (peakDb >= -24 && peakDb < -14) {
    verdict = 'acceptable';
  } else {
    verdict = 'low';
  }
  micCheck.value = {
    status: 'done',
    count: 0,
    peakDb: Math.round(peakDb),
    rmsDb: Math.round(rms),
    clipped,
    verdict,
  };
}

/* ---------------- voice test ---------------- */

let diagTok = 0;
let diagData: Partial<Record<VoiceTestStep, Float32Array>> = {};
let diagT = 0;

export async function diagButton(): Promise<void> {
  const d = diag.value;
  if (d) {
    if (d.phase === 'rec') void diagEndStep();
    return;
  }
  if (run || noise.value.busy) return;
  if (!engine.micReady && !(await enableMic())) {
    diagMsg.value = t('profile.needMic');
    return;
  }
  stopRef();
  stopPlay();
  diagData = {};
  diagMsg.value = '';
  diagStart(0);
}

function diagStart(i: number): void {
  const tok = ++diagTok;
  diagT = engine.now + 2;
  diag.value = { i, phase: 'prep', startIn: 2, left: VOICE_TEST_STEPS[i].dur, progress: 0 };
  const loop = () => {
    const d = diag.value;
    if (!d || tok !== diagTok) return;
    const now = engine.now, st = VOICE_TEST_STEPS[d.i];
    if (d.phase === 'prep') {
      if (now >= diagT) {
        diagT = now;
        engine.startCapture();
        diag.value = { ...d, phase: 'rec', left: st.dur, progress: 0 };
      } else if (Math.ceil(diagT - now) !== d.startIn) diag.value = { ...d, startIn: Math.ceil(diagT - now) };
    } else if (d.phase === 'rec') {
      const el = now - diagT;
      if (el >= st.dur) { void diagEndStep(); return; }
      diag.value = { ...d, left: Math.max(0, Math.ceil(st.dur - el)), progress: Math.min(1, el / st.dur) };
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

async function diagEndStep(): Promise<void> {
  const d = diag.value;
  if (!d || d.phase !== 'rec') return;
  const tok = ++diagTok;
  diag.value = { ...d, phase: 'done' };
  const raw = await engine.stopCapture();
  if (tok !== diagTok) return;
  diagData[VOICE_TEST_STEPS[d.i].k] = raw;
  if (d.i + 1 < VOICE_TEST_STEPS.length) { diagStart(d.i + 1); return; }
  setTimeout(finishDiag, 40);
}

function finishDiag(): void {
  const res = analyzeVoiceTest(diagData, engine.sampleRate, thr());
  diagData = {};
  diag.value = null;
  if (!res.ok) { diagMsg.value = t(res.reason === 'narrow-siren' ? 'profile.narrowSiren' : 'profile.noSiren'); return; }
  update({ profile: res.profile });
  diagMsg.value = t('profile.done');
}

export function cancelDiag(): void {
  diagTok++;
  if (engine.capturing) void engine.stopCapture();
  diagData = {};
  diag.value = null;
}

/* ---------------- range ---------------- */

export function applyProfile(): void {
  const P = settings.value.profile;
  if (!P) return;
  update({ range: { low: P.low, high: P.high, src: 'measured' } });
}

export function setRange(low: number, high: number): void {
  if (high - low < MIN_SPAN) high = low + MIN_SPAN;
  update({ range: { low, high, src: 'manual' } });
}

export function setPreset(v: VoiceId): void {
  update({ range: { ...presetRange(v), src: 'preset', preset: v } });
}

export function togglePack(id: string, on: boolean): void {
  const cur = packs.value;
  const next = on ? [...new Set([...cur, id])] : cur.filter(x => x !== id);
  if (!next.length) { toast(t('packs.needOne')); return; }
  update({ packs: next });
}

export function finishOnboarding(): void {
  update({ onboarded: true });
}

/* ---------------- my lyrics ---------------- */

export function addLyrics(raw: string, lang: LyricLang): number {
  const add = parseLines(raw, lang, lyrics.value);
  if (add.length) lyrics.value = [...lyrics.value, ...add];
  return add.length;
}

/** Removes a lyric line and the takes recorded from it. */
export function removeLyric(id: string): void {
  lyrics.value = lyrics.value.filter(l => l.id !== id);
  const prefix = 'ly-' + id + '-';
  const next = new Map(takes.value);
  for (const [k, tk] of next) if (tk.id.startsWith(prefix)) { next.delete(k); deleteTake(k); }
  takes.value = next;
  if (pending.value?.id.startsWith(prefix)) { pending.value = null; phase.value = 'idle'; }
}

export function clearLyrics(): void {
  for (const l of lyrics.value) removeLyric(l.id);
}

/* ---------------- exports ---------------- */

function readme(): string {
  const S = settings.value;
  const real = currentTakes().filter(x => !x.external);
  const sr = real.find(x => x.sr)?.sr;
  const exById = new Map(bank.value.map(e => [e.id, e]));
  return [
    t('readme.title'),
    t('readme.date', { d: new Date().toLocaleString(locale.value) }),
    t('readme.takes', { n: real.length }),
    t('readme.voiced', { m: num(totals.value.v / 60, 2) }),
    t('readme.format', { bits: S.bits, sr: sr ?? '?' }),
    t('readme.voice', {
      lo: midiToNote(S.range.low),
      hi: midiToNote(S.range.high),
      src: S.range.src === 'preset' && S.range.preset ? t(`voices.${S.range.preset}`) : t(`profile.src.${S.range.src}`),
      tr: signed(tr.value),
    }),
    '',
    t('readme.applio'),
    ...tList('readme.steps'),
    '',
    t('readme.index'),
    ...real.map(x => takeFileName(x) + '  |  ' + lt(exById.get(x.id)?.title) + '  |  ' + x.voiced.toFixed(1) + ' s'),
  ].join('\n');
}

/** Takes of exercises still in the bank, renumbered to their current position (file names follow the bank). */
function currentTakes(): Take[] {
  const pos = new Map(bank.value.map(e => [e.id, e.n]));
  // takes of exercises no longer in the bank (e.g. a language turned off) are kept, numbered after the bank
  let extra = bank.value.length;
  const orphanN = new Map<string, number>();
  const n = (id: string) => pos.get(id) ?? orphanN.get(id) ?? (orphanN.set(id, ++extra), extra);
  return sortTakes([...takes.value.values()].map(x => ({ ...x, n: n(x.id) })));
}

function applioDatasetInfo(): string {
  const S = settings.value;
  const real = currentTakes().filter(x => !x.external);
  const sr = real.find(x => x.sr)?.sr ?? engine.sampleRate;
  const mix = registerMix(real, bank.value);
  const info = {
    name: 'rvc_dataset',
    generator: 'RVC Dataset Studio',
    version: '1.0.0',
    date: new Date().toISOString(),
    audio_format: {
      sample_rate: sr,
      channels: 1,
      bit_depth: S.bits,
    },
    statistics: {
      total_takes: real.length,
      voiced_seconds: Math.round(totals.value.v * 10) / 10,
      voiced_minutes: Math.round((totals.value.v / 60) * 100) / 100,
    },
    vocal_profile: {
      range_midi: [S.range.low, S.range.high],
      range_notes: [midiToNote(S.range.low), midiToNote(S.range.high)],
      register_mix_percent: {
        chest: Math.round(mix.percentages.chest),
        mixed: Math.round(mix.percentages.mixed),
        falsetto: Math.round(mix.percentages.falsetto),
        speech: Math.round(mix.percentages.speech),
      },
    },
    applio_recommended_settings: {
      pitch_guidance: true,
      f0_detector: 'rmvpe',
      recommended_pretrain: 'Ov2Super (or Titan / Snowie)',
      sample_rate: '40k',
      batch_size: 8,
      total_epochs: 150,
      save_every_epoch: 10,
      index_algorithm: 'Auto',
      inference_defaults: {
        index_rate: 0.60,
        filter_radius: 3,
        rms_mix_rate: 0.25,
        protect: 0.33,
      },
    },
  };
  return JSON.stringify(info, null, 2);
}

export async function downloadZip(): Promise<void> {
  const real = currentTakes().filter(x => x.pcm);
  if (!real.length) return;
  toast(t('toast.preparingZip'));
  const parts = await buildZip(datasetEntries(real, settings.value.bits, readme(), 'rvc_dataset', applioDatasetInfo()));
  download(parts as BlobPart[], 'rvc_dataset.zip', 'application/zip');
  toast(t('toast.downloading', { name: 'rvc_dataset.zip' }));
}

export function downloadSession(): void {
  const r = sessionWav(currentTakes(), settings.value.bits);
  if (!r) return;
  download([r.data as BlobPart], 'rvc_session_full.wav', 'audio/wav');
  toast(r.skipped ? t('toast.srMismatch') : t('toast.downloading', { name: 'rvc_session_full.wav' }));
}

export function downloadTake(): void {
  const tk = shownTake();
  if (!tk?.pcm || !tk.sr) return;
  const r = sessionWav([tk], settings.value.bits)!;
  const name = takeFileName(tk);
  download([r.data as BlobPart], name, 'audio/wav');
  toast(t('toast.downloading', { name }));
}

export function clearSession(): void {
  clearTakes();
  batch(() => {
    takes.value = new Map();
    pending.value = null;
    phase.value = 'idle';
  });
  toast(t('toast.cleared'));
}

/* ---------------- keyboard ---------------- */

function onKey(e: KeyboardEvent): void {
  if (e.metaKey || e.ctrlKey || e.altKey || diag.value) return;
  const el = e.target as HTMLElement | null;
  if (el?.closest('input,select,textarea,[contenteditable]')) return;
  const onControl = !!el?.closest('button,a,summary');
  const k = e.key.toLowerCase();
  if (e.code === 'Space' && !onControl) { e.preventDefault(); void recButton(); }
  else if (e.key === 'Enter' && !onControl) { e.preventDefault(); void accept(); }
  else if (k === 'r') redo();
  else if (k === 't') toggleTone();
  else if (k === 'm') update({ muted: !settings.value.muted });
  else if (e.key === 'ArrowRight' && !el?.closest('canvas,[role="slider"]')) { e.preventDefault(); go(idx.value + 1); }
  else if (e.key === 'ArrowLeft' && !el?.closest('canvas,[role="slider"]')) { e.preventDefault(); go(idx.value - 1); }
}

/* ---------------- boot ---------------- */

export async function boot(): Promise<void> {
  engine.onRefChange = p => {
    refPlaying.value = p;
    if (!p && demo) { demo = null; resetKaraoke(current.value); }
  };
  engine.onMicLost = () => {
    mic.value = { status: 'off' };
    toast(t('toast.micLost'));
  };
  document.addEventListener('keydown', onKey);
  // A mouse click leaves focus on the button; drop it so Space/Enter keep driving the recorder.
  document.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest('button');
    if (b && e.detail > 0) b.blur();
  });
  startLiveLoop();
  const ok = await openDB();
  dbOk.value = ok;
  if (!ok) return;
  void requestPersistence();
  const list = await allTakes();
  // keep every take, also from languages currently turned off; numbers follow the current bank
  const pos = new Map(bank.value.map(e => [e.id, e.n]));
  const map = new Map<string, Take>();
  for (const x of list) if (x && x.key && x.id) map.set(x.key, { ...x, n: pos.get(x.id) ?? x.n });
  takes.value = map;
  if (map.size) toast(tn('toast.recovered', map.size));
}
