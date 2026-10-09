import { useEffect, useRef, useState } from 'preact/hooks';
import { VOICE_TEST_STEPS, type VocalProfile } from '../../analysis/profile';
import { applyProfile, cancelDiag, diagButton, setRange } from '../../app/controller';
import { diag, diagMsg, settings, span, voiceTestText } from '../../app/store';
import { locale, num, t } from '../../i18n';
import { midiToHz, midiToNote, minus, signed } from '../../lib/music';
import { onResize, prepCanvas, token } from '../canvas';

const NOTE_MIN = 36, NOTE_MAX = 88;
const hz = (m: number) => midiToHz(m).toFixed(0) + ' Hz';

export function NoteSelect({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const opts = [];
  for (let m = NOTE_MIN; m <= NOTE_MAX; m++) opts.push(<option key={m} value={m}>{midiToNote(m)}</option>);
  return (
    <select aria-label={label} value={value} onChange={e => onChange(+(e.target as HTMLSelectElement).value)}>
      {opts}
    </select>
  );
}

function Ltas({ P }: { P: VocalProfile }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [read, setRead] = useState(t('profile.ltasLegend'));
  useEffect(() => {
    const c = ref.current;
    if (!c || !P.ltas) return;
    const data = P.ltas;
    const draw = () => {
      const { g, w, h } = prepCanvas(c, 130);
      const padL = 30, padR = 8, padT = 8, padB = 18;
      const fx = (f: number) => padL + (Math.log(f / 80) / Math.log(100)) * (w - padL - padR);
      const fy = (d: number) => padT + Math.min(1, -d / 60) * (h - padT - padB);
      g.font = '10px ' + (token('--f-mono') || 'monospace');
      g.fillStyle = token('--faint');
      [0, -20, -40, -60].forEach(d => {
        g.fillRect(padL, fy(d), w - padL - padR, 1);
        g.fillText(d === 0 ? '0 dB' : minus(d), 2, fy(d) + 3);
      });
      ([[100, '100'], [250, '250'], [500, '500'], [1000, '1k'], [2000, '2k'], [4000, '4k'], [8000, '8k']] as const).forEach(([f, l]) => g.fillText(l, fx(f) - 8, h - 4));
      g.fillStyle = token('--panel2');
      g.fillRect(fx(2000), padT, fx(4000) - fx(2000), h - padT - padB);
      g.strokeStyle = token('--amber');
      g.lineWidth = 2;
      g.beginPath();
      data.forEach(([f, d], i) => (i ? g.lineTo(fx(f), fy(d)) : g.moveTo(fx(f), fy(d))));
      g.stroke();
      g.lineWidth = 1;
      if (P.peakHz) {
        const pk = data.reduce((a, p) => (Math.abs(p[0] - P.peakHz!) < Math.abs(a[0] - P.peakHz!) ? p : a));
        g.fillStyle = token('--amber-hi');
        g.beginPath(); g.arc(fx(pk[0]), fy(pk[1]), 4, 0, Math.PI * 2); g.fill();
      }
      c.onmousemove = e => {
        const r = c.getBoundingClientRect(), x = e.clientX - r.left;
        const f = 80 * Math.pow(100, (x - padL) / (w - padL - padR));
        const p = data.reduce((a, q) => (Math.abs(Math.log(q[0] / f)) < Math.abs(Math.log(a[0] / f)) ? q : a));
        setRead(t('profile.ltasRead', { f: p[0] >= 1000 ? num(p[0] / 1000, 2) + ' kHz' : p[0] + ' Hz', d: minus(p[1].toFixed(1)) }));
      };
      c.onmouseleave = () => setRead(t('profile.ltasLegend'));
    };
    draw();
    return onResize(c, draw);
  }, [P, locale.value]);
  return (
    <>
      <canvas class="ltas" ref={ref} role="img" aria-label={t('profile.ltasAria')} />
      <div class="note mono">{read}</div>
    </>
  );
}

function Results({ P }: { P: VocalProfile }) {
  const R = settings.value.range;
  const inUse = R.src === 'measured' && R.low === P.low && R.high === P.high;
  const rows: [string, preact.ComponentChildren][] = [];
  rows.push([t('profile.rows.siren'), midiToNote(P.sirenLow) + '–' + midiToNote(P.sirenHigh)]);
  rows.push([t('profile.rows.comfortRange'), midiToNote(P.low) + '–' + midiToNote(P.high)]);
  if (P.comfort != null && P.stab != null) rows.push([t('profile.rows.comfort'), midiToNote(P.comfort) + ' · ' + t('profile.rows.wobble', { c: P.stab.toFixed(0) })]);
  if (P.speech != null && P.speechSpan != null)
    rows.push([t('profile.rows.speech'), `${midiToNote(P.speech)} (${hz(P.speech)}) · ` + t('profile.rows.intonation', { st: num(P.speechSpan) })]);
  rows.push([t('profile.rows.closest'), P.types.map(x => t(`voiceTypes.${x}` as 'voiceTypes.tenor')).join(' · ')]);
  if (P.peakHz) rows.push([t('profile.rows.presence'), num(P.peakHz / 1000, 2) + ' kHz']);
  else if (P.ltas) rows.push([t('profile.rows.presence'), <span class="c-warn">{t('profile.rows.noPeak')}</span>]);
  if (P.centroid && P.bright != null)
    rows.push([t('profile.rows.brightness'), t('profile.rows.brightVal', { c: num(P.centroid / 1000, 2), b: minus(P.bright.toFixed(1)) })]);
  return (
    <>
      <dl class="kv">
        {rows.map(([k, v], i) => (
          <div class="contents" key={i}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
      <div class="row-btns">
        {inUse
          ? <p class="note">{t('profile.applied')}</p>
          : <button class="btn btn-sm btn-accept" type="button" onClick={applyProfile}>{t('profile.apply')}</button>}
      </div>
      <p class="note">{t('profile.disclaimer')}</p>
      {P.ltas && <Ltas P={P} />}
    </>
  );
}

export function DiagBox() {
  const d = diag.value;
  if (!d) return null;
  if (d.phase === 'done' && d.i === VOICE_TEST_STEPS.length - 1)
    return <div class="diag" role="status"><div class="diag-t">{t('profile.analyzing')}</div></div>;
  const st = VOICE_TEST_STEPS[d.i];
  return (
    <div class="diag" role="status" aria-live="polite">
      <div class="diag-t">{t(`profile.steps.${st.k}.title`)}</div>
      <p>{t(`profile.steps.${st.k}.txt`, { text: voiceTestText.value })}</p>
      <div class="hold"><div class="hold-fill" style={{ width: (d.phase === 'rec' ? d.progress * 100 : 0) + '%' }} /></div>
      <div class="mono">{d.phase === 'prep' ? t('profile.startIn', { n: d.startIn }) : d.phase === 'rec' ? t('profile.recording', { s: d.left }) : ''}</div>
    </div>
  );
}

export function ProfilePanel() {
  const S = settings.value;
  const P = S.profile;
  const b = span.value;
  const d = diag.value;
  const adj = S.transpose ? t('profile.adjust', { n: signed(S.transpose) }) : '';
  const srcLabel = S.range.src === 'preset' && S.range.preset ? t(`voices.${S.range.preset}`) : t(`profile.src.${S.range.src}`);
  return (
    <section class="panel" aria-labelledby="h-profile">
      <div class="phead">
        <h2 id="h-profile">{t('profile.title')}</h2>
        <span class="label">{srcLabel}</span>
      </div>
      <div class="pbody">
        <div class="rng">
          <span class="lbl" id="lbl-range">{t('profile.range')}</span>
          <div class="flex items-center gap-2" role="group" aria-labelledby="lbl-range">
            <NoteSelect label={t('profile.lowAria')} value={S.range.low} onChange={v => setRange(v, S.range.high)} />
            <span aria-hidden="true">–</span>
            <NoteSelect label={t('profile.highAria')} value={S.range.high} onChange={v => setRange(S.range.low, v)} />
          </div>
        </div>
        <p class="note">{t('profile.bankNow', { lo: midiToNote(b.lo), hi: midiToNote(b.hi), adj })}</p>
        {P ? <Results P={P} /> : S.range.src === 'assumed' ? <p class="note">{t('profile.assumed')}</p> : null}
        <DiagBox />
        <div class="row-btns">
          <button class="btn btn-sm" type="button" disabled={!!d && d.phase !== 'rec'} onClick={() => void diagButton()}>
            {d ? t('profile.endStep') : P ? t('profile.retest') : t('profile.test')}
          </button>
          {d && <button class="btn btn-sm" type="button" onClick={cancelDiag}>{t('profile.cancel')}</button>}
        </div>
        {diagMsg.value && <p class="note" role="status">{diagMsg.value}</p>}
      </div>
    </section>
  );
}
