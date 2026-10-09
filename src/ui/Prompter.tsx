import { useLayoutEffect } from 'preact/hooks';
import { takeKey } from '../analysis/qc';
import { outOfRange } from '../bank/calibrate';
import type { Exercise } from '../bank/types';
import { accept, go, recButton, redo, toggleTone, isRunning } from '../app/controller';
import { dom, resetKaraoke } from '../app/live';
import { tipFor, bank, countN, current, idx, mic, pending, phase, refPlaying, settings, takes, tr, update } from '../app/store';
import { lt, num, t } from '../i18n';
import { midiToHz, midiToNote, pad3 } from '../lib/music';

export const CAT_INDEX = { vowels: 1, glides: 2, speech: 3, phonemes: 4, dynamics: 5, lyrics: 6 } as const;

export function keyLabel(ex: Exercise, T: number): string {
  if (ex.mode === 'sustain') {
    const m = ex.syl.find(s => s.f)!.f![0] + T;
    return midiToNote(m) + ' · ' + num(midiToHz(m)) + ' Hz';
  }
  if (ex.mode === 'glide') return ex.syl[0].f!.map(m => midiToNote(m + T)).join(' ↝ ');
  if (ex.mode === 'melody') {
    const ms = ex.syl.filter(s => s.f).map(s => s.f![0] + T);
    return midiToNote(Math.min(...ms)) + '–' + midiToNote(Math.max(...ms));
  }
  if (ex.mode === 'tones') return t('prompter.contour', { note: midiToNote(Math.min(...ex.syl.flatMap(s => s.f ?? [])) + T) });
  return t('prompter.speech');
}

const vowelHint = (v?: string): string => (v ? t(`vowelHint.${v}` as 'vowelHint.AAAH') : '').replace(/^vowelHint\..*/, '');

function PromptText({ ex }: { ex: Exercise }) {
  const size = ex.mode === 'speech' ? 'sz-s' : ex.mode === 'sustain' || ex.mode === 'glide' ? 'sz-l' : 'sz-m';
  const parts: (string | preact.JSX.Element)[] = [];
  ex.syl.forEach((s, i) => {
    const hy = /-$/.test(s.t);
    const txt = hy ? s.t.slice(0, -1) : s.t;
    if (s.zh)
      parts.push(
        <span key={i} class="syl zhsyl" data-i={i}>
          <span class="zh" lang="zh-Hans">{s.zh}</span>
          <span class="py" lang="zh-Latn-pinyin">{txt}</span>
        </span>,
      );
    else parts.push(<span key={i} class={'syl' + (s.hi ? ' hi' : '') + (s.sep ? ' sep' : '') + (s.em ? ' em hi' : '')} data-i={i}>{txt}</span>);
    if (i < ex.syl.length - 1 && !hy && ex.join) parts.push(ex.join);
  });
  return (
    <div class={'prompt ' + size} aria-live="polite" ref={el => { dom.prompt = el; }} lang={ex.source === 'core' ? undefined : ex.source}>
      {parts}
    </div>
  );
}

export function Prompter() {
  const ex = current.value;
  const S = settings.value;
  const T = tr.value;
  const ph = phase.value;
  const m = mic.value;
  const rehearse = m.status === 'blocked';
  const live = ph === 'prep' || ph === 'rec';
  const has = !!pending.value || takes.value.has(takeKey(S.pass, ex.id));
  const oor = outOfRange(ex, T, S.range);
  const cat = CAT_INDEX[ex.cat];
  const n = countN.value;

  useLayoutEffect(() => { resetKaraoke(ex); }, [ex]);

  const phaseTxt =
    ph === 'prep' ? t('phase.prep')
    : ph === 'rec' ? (m.status === 'ready' ? t('phase.rec') : t('phase.recRehearse'))
    : ph === 'review' ? t('phase.review')
    : rehearse ? t('phase.idleRehearse') : t('phase.idle');
  const holdLbl = ex.mode === 'speech' || ex.mode === 'drill' ? t('prompter.holdRhythm') : ex.mode === 'sustain' ? t('prompter.holdSustain') : t('prompter.holdPhrase');
  const sub = ex.mode === 'glide' ? t('prompter.glideSub', { label: keyLabel(ex, T), hint: vowelHint(ex.vowel) }) : lt(ex.sub) || (ex.mode === 'sustain' ? vowelHint(ex.vowel) : '');

  const ticks: preact.JSX.Element[] = [];
  for (let s = 1; s < ex.dur; s++) ticks.push(<i key={'s' + s} style={{ left: (s / ex.dur) * 100 + '%' }} />);
  if (ex.mode === 'melody' || ex.mode === 'tones') ex.sched.slice(1).forEach((x, j) => ticks.push(<i key={'g' + j} class="seg" style={{ left: (x.t0 / ex.dur) * 100 + '%' }} />));
  const labels: preact.JSX.Element[] = [];
  for (let s = 0; s <= ex.dur; s++)
    labels.push(<span key={s} style={{ left: (s / ex.dur) * 100 + '%', transform: s === 0 ? 'none' : s === ex.dur ? 'translateX(-100%)' : undefined }}>{s}s</span>);

  return (
    <section class="stagecol" aria-label={t('prompter.region')} id="prompter">
      <div class="panel card-prompt">
        <div class="tags">
          <span class="tag cat" style={{ '--c': `var(--cat${cat})` }}>{t(`cats.${ex.cat}`)}</span>
          {lt(ex.reg) && <span class="tag">{t('prompter.register')} <b>{lt(ex.reg)}</b></span>}
          <span class={'tag' + (oor ? ' tag-warn' : '')}>
            {t('prompter.reference')} <b>{keyLabel(ex, T)}</b>{oor ? ' · ' + t(oor === 'above' ? 'prompter.above' : 'prompter.below') : ''}
          </span>
          {lt(ex.emo) && <span class="tag">{t('prompter.emotion')} <b>{lt(ex.emo)}</b></span>}
          <span class="tag">{t('prompter.take')} <b>{ex.dur}s</b></span>
        </div>
        <div class="stage">
          <div class="staff" aria-hidden="true" />
          <div class="phase" data-p={ph} role="status"><span class="pd" />{phaseTxt}</div>
          <span class="prompt-live-pitch" ref={el => { dom.promptLivePitch = el; }} aria-live="off" />
          <div class="exno">#{pad3(ex.n)}{S.pass > 1 ? ' · P' + S.pass : ''}</div>
          {n != null && (
            <div class="count" aria-hidden="true">
              <div><div class="n">{n}</div><div class="w">{t('prompter.count')}</div></div>
            </div>
          )}
          <PromptText ex={ex} />
          <div class="sub">{sub}</div>
        </div>
        <div class="holdwrap">
          <div class="holdrow">
            <span class="label">{holdLbl}</span>
            <span class="holdtime" ref={el => { dom.holdTime = el; }}>{num(0)}s / {ex.dur}s</span>
          </div>
          <div class="hold" ref={el => { dom.hold = el; }}>
            <div class="hold-fill" ref={el => { dom.holdFill = el; }} />
            <div class="hold-ticks">{ticks}</div>
          </div>
          <div class="ticklabels" aria-hidden="true">{labels}</div>
        </div>
        <div class="tip"><span class="ic" aria-hidden="true">i</span><span>{tipFor(ex)}</span></div>
        <div class="controls">
          <button class="btn" type="button" aria-label={t('btn.prevAria')} disabled={idx.value === 0} onClick={() => go(idx.value - 1)}>{t('btn.prev')}</button>
          <button class="btn" type="button" disabled={!ex.pitched || live} onClick={toggleTone}>{refPlaying.value && !live ? t('btn.toneStop') : t('btn.tone')}</button>
          <button class={'btn' + (S.muted ? ' active' : '')} type="button" aria-pressed={S.muted} onClick={() => update({ muted: !S.muted })}>
            {S.muted ? t('btn.guideMute') : t('btn.guideSound')}
          </button>
          <button class={'btn btn-rec' + (live ? ' is-live' : rehearse ? ' rehearse' : '')} type="button" onClick={() => void recButton()}>
            <span class="dot" aria-hidden="true" />
            <span>{live ? t('btn.stop') : rehearse ? t('btn.rehearse') : t('btn.rec')}</span>
          </button>
          <button class="btn" type="button" disabled={live || !has} onClick={redo}>{t('btn.redo')}</button>
          <button class="btn btn-accept" type="button" disabled={live || !pending.value || isRunning()} onClick={() => void accept()}>
            {pending.value?.external ? t('btn.markDone') : t('btn.accept')}
          </button>
          <button class="btn" type="button" aria-label={t('btn.nextAria')} disabled={idx.value === bank.value.length - 1} onClick={() => go(idx.value + 1)}>{t('btn.next')}</button>
        </div>
        <div class="keys" aria-hidden="true">
          <span><kbd>{t('keys.space')}</kbd> {t('keys.rec')}</span>
          <span><kbd>Enter</kbd> {t('keys.accept')}</span>
          <span><kbd>R</kbd> {t('keys.redo')}</span>
          <span><kbd>T</kbd> {t('keys.tone')}</span>
          <span><kbd>M</kbd> {t('keys.mute')}</span>
          <span><kbd>←</kbd><kbd>→</kbd> {t('keys.nav')}</span>
        </div>
      </div>
    </section>
  );
}
