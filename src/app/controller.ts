import { batch } from '@preact/signals';
import { registerMix } from '../analysis/coverage';
import { analyzeVoiceTest, VOICE_TEST_STEPS, type VoiceTestStep } from '../analysis/profile';
import { analyzeTake, qcList, takeKey, worst, type Take } from '../analysis/qc';
import { rmsDb, vadThreshold } from '../analysis/vad';
import { engine } from '../audio/engine';
import { MIN_SPAN, presetRange, type VoiceId } from '../bank/calibrate';
import { parseLines, saveLyrics } from '../lyrics/generate';
import type { LyricLang } from '../lyrics/syllables';
import type { Exercise } from '../bank/types';
import { download, sessionWav, sortTakes, streamDatasetZip, takeFileName } from '../export/dataset';
import { locale, lt, num, t, tList, tn } from '../i18n';
import { dB, midiToNote, signed } from '../lib/music';
import { allTakes, clearTakes, dbAvailable, deleteTake, openDB, putTake, requestPersistence } from '../storage/idb';
import { saveSettings } from '../storage/settings';
import {
  BACKUP_VERSION, deserializeTake, parseBackup,
  previewRestore, serializeTake, type ProjectBackup, type RestorePreview,
} from '../storage/backup';

import { resetKaraoke, runClock, startLiveLoop, updateHold, updateKaraoke } from './live';
import {
  bank, countN, current, packs, dbOk, diag, diagMsg, exportProgress, idx, lyrics, mic, micCheck, noise, pending, phase, playing, refPlaying,
  sessionSkipped, settings, takes, toast, totals, tr, update,
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
  tk.saveStatus = 'saving';
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
  if (dbAvailable()) {
    try {
      const ok = await putTake(tk);
      tk.saveStatus = ok ? 'saved' : 'failed';
      if (!ok) toast(t('toast.saveFail'));
    } catch {
      tk.saveStatus = 'failed';
      toast(t('toast.saveFail'));
    }
    const updated = new Map(takes.value);
    updated.set(tk.key, { ...tk });
    takes.value = updated;
  }
}

export async function retrySaveTake(tk: Take): Promise<boolean> {
  if (!dbAvailable()) {
    toast(t('toast.saveFail'));
    return false;
  }
  tk.saveStatus = 'saving';
  const next = new Map(takes.value);
  next.set(tk.key, { ...tk });
  takes.value = next;
  try {
    const ok = await putTake(tk);
    tk.saveStatus = ok ? 'saved' : 'failed';
    const updated = new Map(takes.value);
    updated.set(tk.key, { ...tk });
    takes.value = updated;
    if (ok) {
      toast(t('toast.savedTake'));
      return true;
    }
  } catch {
    tk.saveStatus = 'failed';
    const updated = new Map(takes.value);
    updated.set(tk.key, { ...tk });
    takes.value = updated;
  }
  toast(t('toast.saveFail'));
  return false;
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

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });

let noiseAbort: AbortController | null = null;

export function cancelNoise(): void {
  noiseAbort?.abort();
  noiseAbort = null;
}

export async function measureNoise(): Promise<void> {
  if (run || noise.value.busy || diag.value) return;
  if (!engine.micReady && !(await enableMic())) {
    noise.value = { busy: false, count: 0, error: 'needMic' };
    return;
  }
  const ac = new AbortController();
  noiseAbort = ac;
  noise.value = { busy: true, count: 3 };
  engine.startCapture();
  try {
    for (let i = 3; i > 0; i--) {
      if (ac.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      noise.value = { busy: true, count: i };
      await sleep(1000, ac.signal);
    }
    const x = await engine.stopCapture();
    update({ noiseDb: Math.round(rmsDb(x)) });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      await engine.stopCapture().catch(() => {});
      noise.value = { busy: false, count: 0 };
      return;
    }
    await engine.stopCapture().catch(() => {});
    noise.value = { busy: false, count: 0, error: 'fail' };
  } finally {
    noiseAbort = null;
    noise.value = { ...noise.value, busy: false, count: 0 };
  }
}

let micCheckAbort: AbortController | null = null;

export function cancelMicCheck(): void {
  micCheckAbort?.abort();
  micCheckAbort = null;
}

export async function runMicCheck(): Promise<void> {
  if (run || noise.value.busy || diag.value || micCheck.value.status === 'measuring') return;
  if (!engine.micReady && !(await enableMic())) {
    micCheck.value = { ...micCheck.value, status: 'idle', error: 'needMic' };
    return;
  }
  const ac = new AbortController();
  micCheckAbort = ac;
  micCheck.value = { status: 'measuring', count: 5, peakDb: null, rmsDb: null, clipped: false, verdict: null, error: undefined };
  engine.startCapture();
  try {
    for (let i = 5; i > 0; i--) {
      if (ac.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      micCheck.value = { ...micCheck.value, count: i };
      await sleep(1000, ac.signal);
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
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      await engine.stopCapture().catch(() => {});
      micCheck.value = { ...micCheck.value, status: 'idle', count: 0 };
      return;
    }
    await engine.stopCapture().catch(() => {});
    micCheck.value = { ...micCheck.value, status: 'idle', error: 'fail' };
  } finally {
    micCheckAbort = null;
    if (micCheck.value.status === 'measuring') {
      micCheck.value = { ...micCheck.value, status: 'idle', count: 0 };
    }
  }
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
  const sampleRates = [...new Set(real.map(x => x.sr).filter((x): x is number => Boolean(x)))];
  const sourceSr = real.find(x => x.sr)?.sr ?? engine.sampleRate;
  // Effective output SR: explicit target wins, otherwise the source rate
  const outputSr = S.exportSR === 'preserve' ? sourceSr : Number(S.exportSR);
  const mix = registerMix(real, bank.value);
  const info = {
    name: 'rvc_dataset',
    generator: 'RVC Dataset Studio',
    version: '1.0.0',
    date: new Date().toISOString(),
    audio_format: {
      output_sample_rate: outputSr,
      output_sample_rates: S.exportSR === 'preserve'
        ? (sampleRates.length ? sampleRates : [sourceSr])
        : [outputSr],
      source_sample_rates: sampleRates.length ? sampleRates : [sourceSr],
      resampled: S.exportSR !== 'preserve' && sourceSr !== outputSr,
      export_policy: S.exportSR,
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
      recommended_pretrain: outputSr >= 48000 ? 'Ov2Super 48k (or Titan / Snowie 48k)' : 'Ov2Super 40k (or Titan / Snowie 40k)',
      sample_rate: outputSr >= 48000 ? '48k' : '40k',
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

let exportAbortController: AbortController | null = null;

export function cancelExport(): void {
  if (exportAbortController) {
    exportAbortController.abort();
    exportAbortController = null;
    exportProgress.value = { active: false, current: 0, total: 0, currentFile: '', percent: 0 };
    toast(t('toast.exportCancelled'));
  }
}

export async function downloadZip(): Promise<void> {
  const real = currentTakes().filter(x => x.pcm);
  if (!real.length || exportProgress.value.active) return;
  toast(t('toast.preparingZip'));
  exportAbortController = new AbortController();
  const signal = exportAbortController.signal;
  const total = real.length + 1 + 1; // takes + README + dataset_info
  exportProgress.value = {
    active: true,
    current: 0,
    total,
    currentFile: '',
    percent: 0,
  };
  try {
    const targetSR = settings.value.exportSR === 'preserve'
      ? undefined
      : Number(settings.value.exportSR);
    const parts = await streamDatasetZip(
      real,
      settings.value.bits,
      readme(),
      applioDatasetInfo(),
      {
        folder: 'rvc_dataset',
        signal,
        targetSR,
        onProgress: p => {
          exportProgress.value = {
            active: true,
            current: p.current,
            total: p.total,
            currentFile: p.currentFile,
            percent: p.percent,
          };
        },
      },
    );
    download(parts as BlobPart[], 'rvc_dataset.zip', 'application/zip');
    toast(t('toast.downloading', { name: 'rvc_dataset.zip' }));
  } catch (err: unknown) {
    if (signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
      return;
    }
    console.error('Failed to export dataset zip:', err);
    toast(t('toast.exportFail'));
  } finally {
    exportAbortController = null;
    exportProgress.value = { active: false, current: 0, total: 0, currentFile: '', percent: 0 };
  }
}

export function downloadSession(): void {
  try {
    const r = sessionWav(currentTakes(), settings.value.bits);
    if (!r) return;
    sessionSkipped.value = r.skippedFiles;
    download([r.data as BlobPart], 'rvc_session_full.wav', 'audio/wav');
    toast(r.skipped ? t('toast.srMismatch') : t('toast.downloading', { name: 'rvc_session_full.wav' }));
  } catch (err) {
    console.error('Failed to export session wav:', err);
    toast(t('toast.exportFail'));
  }
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

/* ---------------- backup / restore ---------------- */

/**
 * Serialises the entire session to a JSON backup and triggers a browser download.
 * Includes: all takes (with PCM), settings, and lyrics.
 */
export async function downloadBackup(): Promise<void> {
  try {
    const allTk = [...takes.value.values()];
    const voicedSeconds = allTk.reduce((s, tk) => s + (tk.voiced ?? 0), 0);

    const backup: ProjectBackup = {
      manifest: {
        version: BACKUP_VERSION,
        createdAt: new Date().toISOString(),
        appVersion: (typeof import.meta !== 'undefined' && (import.meta as unknown as Record<string, unknown>).env)
          ? ((import.meta as { env?: Record<string, unknown> }).env?.['VITE_APP_VERSION'] as string | undefined) ?? 'dev'
          : 'dev',
        takeCount: allTk.length,
        voicedSeconds,
      },
      settings: { ...settings.value },
      lyrics: [...lyrics.value],
      takes: allTk.map(serializeTake),
    };

    const json = JSON.stringify(backup);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toISOString().slice(0, 10);
    a.download = `rvc_backup_${date}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast(t('toast.backupCreated'));
  } catch (err) {
    console.error('Failed to create backup:', err);
    toast(t('toast.restoreFail'));
  }
}

/**
 * Reads and validates a File from a file input.
 * Returns the parsed backup + preview, or throws BackupValidationError.
 */
export async function readBackupFile(
  file: File,
): Promise<{ backup: ProjectBackup; preview: RestorePreview }> {
  const raw = await file.text();
  const backup = parseBackup(raw); // throws BackupValidationError on invalid input
  const preview = previewRestore(backup, takes.value);
  return { backup, preview };
}

/**
 * Commits a validated backup to the store. Call only after the user has
 * confirmed. Transactional approach: puts all new takes first, then updates
 * settings/lyrics signals (so a mid-write failure doesn't lose the old data).
 */
export async function confirmRestore(backup: ProjectBackup): Promise<void> {
  if (run) {
    toast(t('backup.duringRec'));
    return;
  }
  try {
    // 1. Write all takes to IndexedDB first (non-destructive: putTake is upsert)
    const newTakes = backup.takes.map(deserializeTake);
    for (const tk of newTakes) {
      await putTake(tk);
    }

    // 2. Build new takes map (merge: existing + restored)
    const newMap = new Map(takes.value);
    const pos = new Map(bank.value.map(e => [e.id, e.n]));
    for (const tk of newTakes) {
      newMap.set(tk.key, { ...tk, n: pos.get(tk.id) ?? tk.n, saveStatus: 'saved' });
    }

    // 3. Restore settings & lyrics (localStorage)
    if (backup.settings && typeof backup.settings === 'object') {
      const merged = { ...settings.value, ...backup.settings };
      saveSettings(merged as typeof settings.value);
    }
    if (Array.isArray(backup.lyrics) && backup.lyrics.length > 0) {
      saveLyrics(backup.lyrics);
    }

    // 4. Update signals atomically
    batch(() => {
      takes.value = newMap;
      if (Array.isArray(backup.lyrics)) lyrics.value = backup.lyrics;
    });

    toast(t('toast.restoreSuccess'));
  } catch (err) {
    console.error('Failed to restore backup:', err);
    toast(t('toast.restoreFail'));
  }
}

/** Requests persistent storage from the browser and shows a toast with the result. */
export async function requestStoragePersistence(): Promise<boolean> {
  try {
    const granted = await requestPersistence();
    toast(granted ? t('toast.persistGranted') : t('toast.persistDenied'));
    return granted;
  } catch {
    return false;
  }
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
  for (const x of list) if (x && x.key && x.id) map.set(x.key, { ...x, n: pos.get(x.id) ?? x.n, saveStatus: 'saved' });
  takes.value = map;
  if (map.size) toast(tn('toast.recovered', map.size));
}
