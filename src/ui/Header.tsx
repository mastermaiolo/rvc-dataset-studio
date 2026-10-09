import { CATEGORIES } from '../bank/types';
import { enableMic } from '../app/controller';
import { dom } from '../app/live';
import { bank, current, mic, nominal, settings, totals } from '../app/store';
import { locale, LOCALES, num, setLocale, t } from '../i18n';
import { clock } from '../lib/music';

export function Header() {
  const { v, byCat, ext } = totals.value;
  const S = settings.value;
  const goal = S.goal * 60;
  const pct = Math.min(100, (v / goal) * 100);
  const m = mic.value;
  return (
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M2 10h2M6 6v8M9 3v14M12 7v6M15 5v10M18 10h0" stroke="#1C1304" stroke-width="2" stroke-linecap="round" />
          </svg>
        </div>
        <div>
          <h1>{t('app.name')}</h1>
          <p>{t('app.tagline')}</p>
        </div>
      </div>
      <div class="metric">
        <span class="label">{t('header.voiced')}</span>
        <div class="flex items-baseline gap-2">
          <span class="big mono">{clock(v)}</span>
          <span class="small mono">/ {clock(goal)}</span>
        </div>
      </div>
      <div class="metric grow">
        <div class="flex justify-between gap-2">
          <span class="label">
            {t('header.progress', { done: num(v / 60), goal: S.goal, pct: Math.floor(pct) })}
            {ext ? t('header.estimated') : ''}
          </span>
          <span class="label hidden sm:inline">{v >= goal ? t('header.goalReached') : t('header.remaining', { t: clock(goal - v) })}</span>
        </div>
        <div class="segbar" role="progressbar" aria-label={t('header.progressAria')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
          {CATEGORIES.map((c, i) => (
            <div key={c} style={{ width: Math.min(100, ((byCat[c] ?? 0) / goal) * 100).toFixed(2) + '%', background: `var(--cat${i + 1})` }} />
          ))}
        </div>
      </div>
      <div class="metric">
        <span class="label">{t(`passes.${S.pass}` as 'passes.1')}</span>
        <span class="mid mono">{t('header.exerciseOf', { n: current.value.n, total: bank.value.length })}</span>
      </div>
      <div class="metric meterbox">
        <span class="label">
          {t('header.inputPeak')} <span class="mono" ref={el => { dom.peakTxt = el; }}>— dBFS</span>
        </span>
        <div class="meter" aria-hidden="true">
          <div class="meter-fill" ref={el => { dom.meterFill = el; }} />
          <div class="meter-peak" ref={el => { dom.meterPeak = el; }} />
          <span class="clip" ref={el => { dom.clipLed = el; }}>CLIP</span>
        </div>
      </div>
      <select class="lang-select" aria-label={t('app.language')} value={locale.value} onChange={e => setLocale((e.target as HTMLSelectElement).value)}>
        {LOCALES.map(l => <option key={l.id} value={l.id} lang={l.id} title={l.name}>{l.id.toUpperCase()}</option>)}
      </select>
      <button
        class={'btn btn-mic' + (m.status === 'ready' ? ' on' : m.status === 'blocked' ? ' off' : '')}
        type="button"
        onClick={() => void enableMic()}
      >
        {m.status === 'ready' ? t('header.micOn') : m.status === 'blocked' ? t('header.micBlocked') : t('header.micEnable')}
      </button>
    </header>
  );
}

/** Target minutes for a category: its share of the bank's nominal duration applied to the goal. */
export function catTarget(cat: string, goalMin: number): number {
  const n = nominal.value;
  const total = Object.values(n).reduce((a, b) => a + b, 0) || 1;
  return ((n[cat] ?? 0) / total) * goalMin;
}
