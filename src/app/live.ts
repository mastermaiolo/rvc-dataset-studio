import { downsample, yin } from '../analysis/yin';
import { vadThreshold } from '../analysis/vad';
import { expectedMidi } from '../bank/calibrate';
import type { Exercise } from '../bank/types';
import { engine } from '../audio/engine';
import { num, t } from '../i18n';
import { dB, hzToMidi, midiToNote, minus, signedCents } from '../lib/music';
import { current, settings, tr } from './store';

/**
 * 60 fps updates (meters, tuner, karaoke, hold bar) bypass the component tree:
 * components register their elements here and the loops write to them directly.
 */
export const dom: Partial<Record<
  'meterFill' | 'meterPeak' | 'clipLed' | 'peakTxt' | 'tuNote' | 'tuCents' | 'tuNeedle' | 'tuHz' | 'tuTarget' |
  'holdFill' | 'hold' | 'holdTime' | 'prompt' | 'promptLivePitch',
  HTMLElement | null
>> = {};

/* ---------------- karaoke & hold bar ---------------- */

export function resetKaraoke(ex: Exercise): void {
  dom.prompt?.querySelectorAll('.syl').forEach(e => e.classList.remove('lit', 'done'));
  if (dom.holdFill) dom.holdFill.style.width = '0%';
  dom.hold?.classList.remove('over');
  if (dom.holdTime) dom.holdTime.textContent = num(0) + 's / ' + ex.dur + 's';
}

export function updateHold(el: number, ex: Exercise): void {
  const p = Math.min(1, el / ex.dur);
  if (dom.holdFill) dom.holdFill.style.width = (p * 100).toFixed(2) + '%';
  const over = el >= ex.dur;
  dom.hold?.classList.toggle('over', over);
  if (dom.holdTime) dom.holdTime.textContent = over ? ex.dur + 's ' + t('prompter.release') : num(el) + 's / ' + ex.dur + 's';
}

export function updateKaraoke(el: number, ex: Exercise): void {
  const root = dom.prompt;
  if (!root) return;
  for (const x of ex.sched) {
    const e = root.querySelector(`.syl[data-i="${x.i}"]`);
    if (!e) continue;
    const lit = el >= x.t0 && el < x.t1;
    e.classList.toggle('lit', lit || (el >= ex.dur && ex.sched.length === 1));
    e.classList.toggle('done', el >= x.t1 && ex.sched.length > 1);
  }
}

/* ---------------- recording clock ---------------- */

/** Set by the controller while a take runs, so the tuner knows the moving target. */
export const runClock: { tRec: number | null } = { tRec: null };

/* ---------------- meter & tuner loop ---------------- */

const td = new Float32Array(2048);
let pkHold = -90, pkT = 0, clipT = 0, smM: number | null = null, frame = 0;
const pos = (d: number) => Math.max(0, Math.min(100, ((d + 60) / 60) * 100));

function loop(): void {
  requestAnimationFrame(loop);
  const an = engine.analyser, ctx = engine.ctx;
  if (!an || !ctx) return;
  an.getFloatTimeDomainData(td);
  let pk = 0, s = 0;
  for (let i = 0; i < td.length; i++) {
    const v = td[i], a = v < 0 ? -v : v;
    if (a > pk) pk = a;
    s += v * v;
  }
  const rdb = dB(Math.sqrt(s / td.length)), pdb = dB(pk), now = performance.now();
  if (dom.meterFill) dom.meterFill.style.width = pos(pdb) + '%';
  if (pdb > pkHold || now - pkT > 1200) { pkHold = pdb; pkT = now; }
  if (dom.meterPeak) dom.meterPeak.style.left = pos(pkHold) + '%';
  if (pk >= 0.99) clipT = now;
  dom.clipLed?.classList.toggle('on', now - clipT < 1500);
  if (frame++ % 6 === 0 && dom.peakTxt) dom.peakTxt.textContent = pkHold > -89 ? minus(pkHold.toFixed(1)) + ' dBFS' : '— dBFS';
  if (frame % 2) return;

  const S = settings.value, ex = current.value, T = tr.value;
  const k = Math.max(1, Math.round(ctx.sampleRate / 24000));
  const f = rdb > Math.max(-52, vadThreshold(S.vad, S.noiseDb) - 4) ? yin(downsample(td, k), ctx.sampleRate / k) : null;
  let target: number | null = null;
  if (runClock.tRec != null && ctx.currentTime >= runClock.tRec) target = expectedMidi(ex, ctx.currentTime - runClock.tRec, T);
  else if (ex.pitched && ex.mode !== 'tones') target = ex.sched.find(x => x.f)!.f![0] + T;
  const needle = dom.tuNeedle;
  if (!f) {
    needle?.classList.remove('live');
    smM = null;
    if (dom.tuTarget) dom.tuTarget.textContent = target != null ? t('tuner.target', { n: midiToNote(target) }) : t('tuner.targetNone');
    if (dom.promptLivePitch) dom.promptLivePitch.textContent = '';
    return;
  }
  const m = hzToMidi(f);
  smM = smM == null || Math.abs(smM - m) > 0.8 ? m : smM * 0.6 + m * 0.4;
  let ref = Math.round(smM);
  if (target != null && ex.mode !== 'tones') ref = Math.abs(smM - target) <= 1.5 ? target : Math.round(smM);
  const cents = (smM - ref) * 100, ac = Math.abs(cents), cls = ac <= 10 ? 'ok' : ac <= 25 ? 'warn' : 'bad';
  if (dom.tuNote) dom.tuNote.textContent = midiToNote(smM);
  if (dom.tuCents) {
    dom.tuCents.textContent = signedCents(cents);
    dom.tuCents.className = 'tu-cents c-' + cls;
  }
  if (dom.promptLivePitch) {
    dom.promptLivePitch.textContent = `${midiToNote(smM)} (${signedCents(cents)})`;
    dom.promptLivePitch.className = 'prompt-live-pitch c-' + cls;
  }
  if (needle) {
    needle.className = 'tu-needle live bg-' + cls;
    needle.style.left = 50 + Math.max(-50, Math.min(50, cents)) + '%';
  }
  if (dom.tuHz) dom.tuHz.textContent = f.toFixed(1) + ' Hz';
  if (dom.tuTarget) {
    dom.tuTarget.textContent =
      target != null && ex.mode !== 'tones'
        ? t('tuner.target', { n: midiToNote(target) }) +
          (Math.round(smM) !== Math.round(target) && Math.abs(smM - target) > 0.5 ? ' · ' + t(smM > target ? 'tuner.above' : 'tuner.below') : '')
        : t('tuner.free');
  }
}

let started = false;
export function startLiveLoop(): void {
  if (started) return;
  started = true;
  requestAnimationFrame(loop);
}
