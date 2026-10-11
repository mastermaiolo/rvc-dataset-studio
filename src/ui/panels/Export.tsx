import { useEffect, useRef, useState } from 'preact/hooks';
import { takeKey } from '../../analysis/qc';
import { cancelExport, clearSession, downloadSession, downloadZip } from '../../app/controller';
import { bank, dbOk, exportProgress, mic, sessionSkipped, settings, takes, totals, update } from '../../app/store';
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
  void sessionSkipped.value; // re-render when session export skips files

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
        <div class="field">
          <label for="setExportSR">{t('export.targetSR')}</label>
          <select id="setExportSR" value={S.exportSR} onChange={e => update({ exportSR: (e.target as HTMLSelectElement).value as 'preserve' | '40000' | '48000' })}>
            <option value="preserve">{t('export.targetSRPreserve')}</option>
            <option value="40000">{t('export.targetSR40k')}</option>
            <option value="48000">{t('export.targetSR48k')}</option>
          </select>
          <span class="hint">{t('export.targetSRHint')}</span>
        </div>
        {(() => {
          const srs = [...new Set(real.map(x => x.sr).filter((x): x is number => Boolean(x)))];
          if (srs.length <= 1 || S.exportSR === 'preserve') return null;
          const target = Number(S.exportSR);
          const mismatched = real.filter(x => x.sr !== target);
          if (!mismatched.length) return null;
          const list = mismatched.map(x => x.sr!.toString()).join(', ');
          return (
            <p class="note c-warn" role="alert">
              {t('export.srMismatch', { list, target: target.toString() })}
            </p>
          );
        })()}
        <div class="flex flex-col gap-2">
          <button class="btn" type="button" disabled={!real.length || exportProgress.value.active} onClick={() => void downloadZip()}>{t('export.zip')}</button>
          <button class="btn" type="button" disabled={!real.length || exportProgress.value.active} onClick={downloadSession}>{t('export.session')}</button>
          <button class={'btn btn-sm' + (armed ? ' active' : '')} type="button" disabled={exportProgress.value.active} onClick={onClear} aria-live="polite">
            {armed ? t('export.clearConfirm') : t('export.clear')}
          </button>
        </div>
        {sessionSkipped.value.length > 0 && (
          <div class="save-fail-alert" role="alert">
            <span>{t('export.sessionSkipped', { n: sessionSkipped.value.length.toString() })}</span>
            <span class="mono" style={{ fontSize: '11px' }}>{sessionSkipped.value.join(', ')}</span>
          </div>
        )}
        {exportProgress.value.active && (
          <div class="export-progress" role="status" aria-live="polite">
            <div class="export-progress-head">
              <span class="mono">
                {t('export.progress', {
                  cur: exportProgress.value.current,
                  total: exportProgress.value.total,
                  file: exportProgress.value.currentFile || '…',
                })}
              </span>
              <span class="mono">{exportProgress.value.percent}%</span>
            </div>
            <div class="segbar">
              <div style={{ width: `${exportProgress.value.percent}%`, background: 'var(--amber)' }} />
            </div>
            <button class="btn btn-sm btn-warn mt-2" type="button" onClick={cancelExport}>
              {t('export.cancel')}
            </button>
          </div>
        )}
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
