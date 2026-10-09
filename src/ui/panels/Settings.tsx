import type { ComponentChildren } from 'preact';
import { vadThreshold } from '../../analysis/vad';
import { applyProfile, measureNoise, setPass, setPreset } from '../../app/controller';
import { noise, settings, toast, update } from '../../app/store';
import { PASS_OFFSETS, presetRange, VOICE_PRESETS, type VoiceId } from '../../bank/calibrate';
import { t } from '../../i18n';
import { midiToNote, minus, signed } from '../../lib/music';
import { MicCheckWidget } from '../Onboarding';
import { PackPicker } from '../PackPicker';

function Field({ id, label, hint, children }: { id?: string; label: string; hint?: ComponentChildren; children: ComponentChildren }) {
  return (
    <div class="field">
      {id ? <label for={id}>{label}</label> : <span class="lbl">{label}</span>}
      <div class="flex items-center gap-2">{children}</div>
      {hint && <span class="hint" id={id ? id + '-hint' : undefined}>{hint}</span>}
    </div>
  );
}

function NoiseOut() {
  const S = settings.value, n = noise.value;
  if (n.busy) return <>{t('settings.noiseCount', { n: n.count })}</>;
  if (n.error) return <>{t('settings.noiseNeedMic')}</>;
  if (S.noiseDb == null) return <>{t('settings.noiseHint')}</>;
  const d = S.noiseDb;
  const cls = d < -60 ? 'c-ok' : d < -50 ? 'c-warn' : 'c-bad';
  const verdict = d < -60 ? t('settings.noiseExcellent') : d < -50 ? t('settings.noiseOk') : t('settings.noiseBad');
  const [db, rest] = t('settings.noiseResult', { db: minus(d), verdict, thr: minus(Math.round(vadThreshold(S.vad, d))) }).split(' dBFS');
  return <><span class={cls + ' mono'}>{db} dBFS</span>{rest}</>;
}

export function SettingsPanel() {
  const S = settings.value;
  const voiceLabel = (k: VoiceId) => {
    const r = presetRange(k);
    return `${t(`voices.${k}`)} (${midiToNote(r.low)}–${midiToNote(r.high)})`;
  };
  const voiceValue = S.range.src === 'preset' && S.range.preset ? S.range.preset : 'own';
  const onVoice = (v: string) => {
    if (v === 'own') { if (S.profile) applyProfile(); }
    else setPreset(v as VoiceId);
  };
  return (
    <details class="panel">
      <summary>{t('settings.title')}</summary>
      <div class="pbody pt-0">
        <Field id="setGoal" label={t('settings.goal')} hint={t('settings.goalHint')}>
          <input type="number" id="setGoal" min={5} max={30} step={1} value={S.goal} aria-describedby="setGoal-hint"
            onChange={e => update({ goal: Math.max(5, Math.min(30, +(e.target as HTMLInputElement).value || 12)) })} />
        </Field>
        <Field id="setVoice" label={t('settings.voice')} hint={t('settings.voiceHint')}>
          <select id="setVoice" value={voiceValue} aria-describedby="setVoice-hint" onChange={e => onVoice((e.target as HTMLSelectElement).value)}>
            <option value="own" disabled={!S.profile && voiceValue !== 'own'}>{t('voices.own')}</option>
            {(Object.keys(VOICE_PRESETS) as VoiceId[]).map(k => <option key={k} value={k}>{voiceLabel(k)}</option>)}
          </select>
        </Field>
        <div class="field">
          <span class="lbl">{t('settings.packs')}</span>
          <span />
          <span class="hint" id="setPacks-hint">{t('settings.packsHint')}</span>
          <div class="packs-wrap"><PackPicker id="setPacks" /></div>
        </div>
        <Field id="setTranspose" label={t('settings.transpose')}>
          <input type="range" id="setTranspose" min={-6} max={6} step={1} value={S.transpose}
            aria-valuetext={signed(S.transpose) + ' st'}
            onInput={e => update({ transpose: +(e.target as HTMLInputElement).value })} />
          <span class="rv">{signed(S.transpose).replace('±', '')} st</span>
        </Field>
        <Field id="setPass" label={t('settings.pass')} hint={t('settings.passHint')}>
          <select id="setPass" value={S.pass} aria-describedby="setPass-hint" onChange={e => setPass(+(e.target as HTMLSelectElement).value)}>
            {Object.keys(PASS_OFFSETS).map(k => <option key={k} value={k}>{t(`passes.${k}` as 'passes.1')}</option>)}
          </select>
        </Field>
        <Field id="setBits" label={t('settings.bits')}>
          <select id="setBits" value={S.bits} onChange={e => update({ bits: +(e.target as HTMLSelectElement).value === 24 ? 24 : 16 })}>
            <option value={16}>{t('settings.bits16')}</option>
            <option value={24}>{t('settings.bits24')}</option>
          </select>
        </Field>
        <Field id="setVad" label={t('settings.vad')} hint={t('settings.vadHint')}>
          <input type="range" id="setVad" min={-60} max={-25} step={1} value={S.vad} aria-describedby="setVad-hint"
            aria-valuetext={S.vad + ' dB'} onInput={e => update({ vad: +(e.target as HTMLInputElement).value })} />
          <span class="rv">{minus(S.vad)} dB</span>
        </Field>
        <Field id="setTrim" label={t('settings.trim')}>
          <input type="checkbox" id="setTrim" checked={S.trim} onChange={e => update({ trim: (e.target as HTMLInputElement).checked })} />
        </Field>
        <Field id="setAdvance" label={t('settings.advance')}>
          <input type="checkbox" id="setAdvance" checked={S.advance} onChange={e => update({ advance: (e.target as HTMLInputElement).checked })} />
        </Field>
        <Field id="setPreroll" label={t('settings.preroll')}>
          <input type="checkbox" id="setPreroll" checked={S.preroll} onChange={e => update({ preroll: (e.target as HTMLInputElement).checked })} />
        </Field>
        <Field id="setGuide" label={t('settings.guide')} hint={t('settings.guideHint')}>
          <input type="checkbox" id="setGuide" checked={S.guide} aria-describedby="setGuide-hint"
            onChange={e => {
              const on = (e.target as HTMLInputElement).checked;
              update({ guide: on });
              if (on) toast(t('toast.guideOn'));
            }} />
        </Field>
        <Field id="setVol" label={t('settings.vol')}>
          <input type="range" id="setVol" min={0} max={1} step={0.05} value={S.vol}
            aria-valuetext={Math.round(S.vol * 100) + '%'}
            onInput={e => update({ vol: +(e.target as HTMLInputElement).value })} />
        </Field>
        <Field label={t('settings.noise')} hint={<span role="status"><NoiseOut /></span>}>
          <button class="btn btn-sm" type="button" disabled={noise.value.busy} onClick={() => void measureNoise()}>{t('settings.noiseBtn')}</button>
        </Field>
        <Field label={t('settings.micCheck')} hint={t('settings.micCheckHint')}>
          <MicCheckWidget />
        </Field>
      </div>
    </details>
  );
}
