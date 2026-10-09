import { useState } from 'preact/hooks';
import { applyProfile, diagButton, finishOnboarding, runMicCheck, setPreset, setRange } from '../app/controller';
import { diag, diagMsg, micCheck, settings, update } from '../app/store';
import { presetRange, VOICE_PRESETS, type VoiceId } from '../bank/calibrate';
import { t } from '../i18n';
import { midiToNote } from '../lib/music';
import { DiagBox, NoteSelect } from './panels/Profile';
import { PackPicker } from './PackPicker';

type Choice = 'test' | 'preset' | 'manual';

export function MicCheckWidget() {
  const mc = micCheck.value;
  return (
    <div class="mic-check-box">
      <div class="flex items-center justify-between gap-2">
        <button
          class="btn btn-sm"
          type="button"
          disabled={mc.status === 'measuring'}
          onClick={() => void runMicCheck()}
        >
          {mc.status === 'measuring'
            ? t('onboarding.micCheckMeasuring', { s: mc.count.toString() })
            : mc.status === 'done'
            ? t('onboarding.micCheckRetest')
            : t('onboarding.micCheckBtn')}
        </button>
      </div>
      {mc.error && <p class="note c-bad">{t('profile.needMic')}</p>}
      {mc.status === 'measuring' && (
        <p class="note c-warn" aria-live="polite">
          {t('onboarding.micCheckMeasuring', { s: mc.count.toString() })}
        </p>
      )}
      {mc.status === 'done' && mc.verdict && (
        <div class={`mic-check-res ${mc.verdict}`} role="status">
          {mc.verdict === 'clipping' && (
            <p class="c-bad">{t('onboarding.micCheckClipping', { pk: mc.peakDb?.toString() ?? '0' })}</p>
          )}
          {mc.verdict === 'optimal' && (
            <p class="c-ok">{t('onboarding.micCheckOptimal', { pk: mc.peakDb?.toString() ?? '-8' })}</p>
          )}
          {mc.verdict === 'acceptable' && (
            <p class="c-warn">{t('onboarding.micCheckAcceptable', { pk: mc.peakDb?.toString() ?? '-16' })}</p>
          )}
          {mc.verdict === 'low' && (
            <p class="c-bad">{t('onboarding.micCheckLow', { pk: mc.peakDb?.toString() ?? '-28' })}</p>
          )}
        </div>
      )}
    </div>
  );
}

/** First run: consent, then the singer's range (test, voice type or manual). The bank is placed from it. */
export function Onboarding() {
  const S = settings.value;
  const [choice, setChoice] = useState<Choice>('test');
  const [preset, setP] = useState<VoiceId>('tenor');
  const [low, setLow] = useState(S.range.low);
  const [high, setHigh] = useState(S.range.high);
  const P = S.profile;
  const d = diag.value;
  const ok = S.consent;

  const start = () => {
    if (!ok) return;
    if (choice === 'preset') setPreset(preset);
    else if (choice === 'manual') setRange(low, high);
    else if (P) applyProfile();
    finishOnboarding();
  };

  return (
    <section class="panel onboarding" aria-labelledby="ob-title">
      <div class="pbody">
        <h2 id="ob-title" class="ob-title">{t('onboarding.title')}</h2>
        <p class="ob-intro">{t('onboarding.intro')}</p>

        <h3 class="label">{t('onboarding.step1')}</h3>
        <label class="ob-consent">
          <input type="checkbox" checked={ok} onChange={e => update({ consent: (e.target as HTMLInputElement).checked })} aria-describedby="ob-consent-hint" />
          <span>{t('onboarding.consent')}</span>
        </label>
        <p class="note" id="ob-consent-hint">{t('onboarding.consentHint')}</p>

        <h3 class="label">{t('onboarding.stepMic')}</h3>
        <p class="note">{t('onboarding.micCheckIntro')}</p>
        <MicCheckWidget />

        <fieldset class="ob-choices" disabled={!ok}>
          <legend class="label">{t('onboarding.step2')}</legend>
          <label class={'ob-choice' + (choice === 'test' ? ' on' : '')}>
            <input type="radio" name="ob" checked={choice === 'test'} onChange={() => setChoice('test')} />
            <span><b>{t('onboarding.optTest')}</b><small>{t('onboarding.optTestHint')}</small></span>
          </label>
          {choice === 'test' && (
            <div class="ob-detail">
              <DiagBox />
              <div class="row-btns">
                <button class="btn btn-sm" type="button" disabled={!!d && d.phase !== 'rec'} onClick={() => void diagButton()}>
                  {d ? t('profile.endStep') : P ? t('profile.retest') : t('profile.test')}
                </button>
              </div>
              {diagMsg.value && !P && <p class="note" role="status">{diagMsg.value}</p>}
              {P && !d && (
                <p class="note c-ok" role="status">
                  {t('onboarding.result', { lo: midiToNote(P.low), hi: midiToNote(P.high), types: P.types.map(x => t(`voiceTypes.${x}` as 'voiceTypes.tenor')).join(' · ') })}
                </p>
              )}
            </div>
          )}
          <label class={'ob-choice' + (choice === 'preset' ? ' on' : '')}>
            <input type="radio" name="ob" checked={choice === 'preset'} onChange={() => setChoice('preset')} />
            <span><b>{t('onboarding.optPreset')}</b></span>
          </label>
          {choice === 'preset' && (
            <div class="ob-detail">
              <select aria-label={t('settings.voice')} value={preset} onChange={e => setP((e.target as HTMLSelectElement).value as VoiceId)}>
                {(Object.keys(VOICE_PRESETS) as VoiceId[]).map(k => {
                  const r = presetRange(k);
                  return <option key={k} value={k}>{t(`voices.${k}`)} ({midiToNote(r.low)}–{midiToNote(r.high)})</option>;
                })}
              </select>
            </div>
          )}
          <label class={'ob-choice' + (choice === 'manual' ? ' on' : '')}>
            <input type="radio" name="ob" checked={choice === 'manual'} onChange={() => setChoice('manual')} />
            <span><b>{t('onboarding.optManual')}</b></span>
          </label>
          {choice === 'manual' && (
            <div class="ob-detail flex items-center gap-2">
              <NoteSelect label={t('profile.lowAria')} value={low} onChange={setLow} />
              <span aria-hidden="true">–</span>
              <NoteSelect label={t('profile.highAria')} value={high} onChange={setHigh} />
            </div>
          )}
        </fieldset>

        <h3 class="label ob-step3">{t('onboarding.step3')}</h3>
        <p class="note" id="ob-packs-hint">{t('settings.packsHint')}</p>
        <PackPicker id="ob-packs" />

        <div class="row-btns">
          <button class="btn btn-accept" type="button" disabled={!ok || (choice === 'test' && !P) || !!d} onClick={start}>
            {choice === 'test' ? t('onboarding.useResult') : t('onboarding.start')}
          </button>
        </div>
        {!ok && <p class="note">{t('onboarding.skipConsent')}</p>}
        <p class="note">{t('onboarding.privacy')} <a href="#privacy">{t('privacy.link')}</a></p>
      </div>
    </section>
  );
}
