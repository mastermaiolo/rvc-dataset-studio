import { useEffect, useRef, useState } from 'preact/hooks';
import { takeKey } from '../../analysis/qc';
import { clearSession, downloadSession, downloadZip } from '../../app/controller';
import { bank, dbOk, mic, settings, takes, totals } from '../../app/store';
import { engine } from '../../audio/engine';
import { num, t } from '../../i18n';
import { clock } from '../../lib/music';

export function ExportPanel() {
  const all = [...takes.value.values()];
  const real = all.filter(x => !x.external);
  const { v } = totals.value;
  const S = settings.value;
  const goal = S.goal * 60;
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  void mic.value; // sample rate label updates once the mic is on

  const passDone = bank.value.every(e => takes.value.has(takeKey(S.pass, e.id)));
  let note = dbOk.value ? t('export.stored') : t('export.notStored');
  if (passDone && v < goal) note = t('export.passDone', { t: clock(goal - v) });
  else if (v >= goal) note = t('export.goalReached');

  const [storage, setStorage] = useState<{ usedMb: number; quotaMb: number } | null>(null);
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      navigator.storage.estimate().then(est => {
        if (est.quota != null && est.usage != null) {
          setStorage({
            usedMb: Math.round(est.usage / (1024 * 1024)),
            quotaMb: Math.round(est.quota / (1024 * 1024)),
          });
        }
      }).catch(() => {});
    }
  }, [all.length]);

  const onClear = () => {
    if (!armed) {
      setArmed(true);
      timer.current = setTimeout(() => setArmed(false), 4000);
      return;
    }
    clearTimeout(timer.current);
    setArmed(false);
    clearSession();
  };

  return (
    <section class="panel" aria-labelledby="h-export">
      <div class="phead">
        <h2 id="h-export">{t('export.title')}</h2>
        <span class="label">{engine.ctx ? num(engine.sampleRate / 1000) + ' kHz · mono' : '— kHz'}</span>
      </div>
      <div class="pbody">
        <div class="stats">
          <div class="stat"><div class="v">{all.length}</div><div class="k">{t('export.takes')}</div></div>
          <div class="stat"><div class="v">{num(v / 60)}</div><div class="k">{t('export.minutes')}</div></div>
          <div class="stat"><div class="v">{real.length ? num(real.reduce((a, x) => a + x.voiced, 0) / real.length) : '—'}</div><div class="k">{t('export.avg')}</div></div>
        </div>
        <div class="flex flex-col gap-2">
          <button class="btn" type="button" disabled={!real.length} onClick={() => void downloadZip()}>{t('export.zip')}</button>
          <button class="btn" type="button" disabled={!real.length} onClick={downloadSession}>{t('export.session')}</button>
          <button class={'btn btn-sm' + (armed ? ' active' : '')} type="button" onClick={onClear} aria-live="polite">
            {armed ? t('export.clearConfirm') : t('export.clear')}
          </button>
        </div>
        <p class="note">{note}</p>
        <p class="note c-ok">{t('export.applioInfo')}</p>
        {storage && (
          <p class="note">
            {t('export.storage', { used: storage.usedMb.toString(), quota: storage.quotaMb.toString() })}
            {storage.usedMb / storage.quotaMb > 0.8 || storage.quotaMb < 150 ? ' ' + t('export.storageWarn') : ''}
          </p>
        )}
      </div>
    </section>
  );
}
