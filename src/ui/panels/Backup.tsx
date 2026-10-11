/**
 * Backup & Restore panel (Etapa 3).
 *
 * - Shows storage usage and persistence status.
 * - "Create backup" → downloads a versioned JSON with all takes + settings + lyrics.
 * - "Restore from backup" → file picker → parse/validate → show preview → confirm → commit.
 *
 * Never destructive without explicit confirmation. Cannot restore while recording.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import {
  confirmRestore,
  downloadBackup,
  isRunning,
  readBackupFile,
  requestStoragePersistence,
} from '../../app/controller';
import { dbOk, takes } from '../../app/store';
import { num, t } from '../../i18n';
import type { ProjectBackup, RestorePreview } from '../../storage/backup';

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

type Step =
  | { kind: 'idle' }
  | { kind: 'preview'; backup: ProjectBackup; preview: RestorePreview }
  | { kind: 'restoring' }
  | { kind: 'error'; msg: string };

/* ------------------------------------------------------------------ */
/* Storage info hook                                                    */
/* ------------------------------------------------------------------ */

interface StorageInfo {
  usedMb: number;
  quotaMb: number;
  pct: number;
  persisted: boolean | null;
}

function useStorageInfo(dep: number): StorageInfo | null {
  const [info, setInfo] = useState<StorageInfo | null>(null);
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    Promise.all([
      navigator.storage?.estimate?.() ?? Promise.resolve(null),
      navigator.storage?.persisted?.() ?? Promise.resolve(null),
    ]).then(([est, persisted]) => {
      if (est && est.quota != null && est.usage != null) {
        const usedMb = Math.round(est.usage / (1024 * 1024));
        const quotaMb = Math.round(est.quota / (1024 * 1024));
        const pct = quotaMb > 0 ? Math.round((usedMb / quotaMb) * 100) : 0;
        setInfo({ usedMb, quotaMb, pct, persisted: persisted ?? null });
      }
    }).catch(() => {});
  // dep = takeCount: re-fetch when the number of takes changes
  }, [dep]);
  return info;
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export function BackupPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  const [loading, setLoading] = useState(false);
  const takeCount = takes.value.size;
  const storageInfo = useStorageInfo(takeCount);

  /* ---- file selection ---- */
  const onFileChange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    // reset input so the same file can be reselected
    if (fileRef.current) fileRef.current.value = '';
    setLoading(true);
    try {
      const { backup, preview } = await readBackupFile(file);
      setStep({ kind: 'preview', backup, preview });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : t('toast.backupInvalid');
      setStep({ kind: 'error', msg });
    } finally {
      setLoading(false);
    }
  };

  /* ---- confirm restore ---- */
  const onConfirm = async () => {
    if (step.kind !== 'preview') return;
    if (isRunning()) {
      setStep({ kind: 'error', msg: t('backup.duringRec') });
      return;
    }
    setStep({ kind: 'restoring' });
    await confirmRestore(step.backup);
    setStep({ kind: 'idle' });
  };

  /* ---- storage persistence request ---- */
  const onPersist = async () => {
    await requestStoragePersistence();
    // Re-trigger storage info update via takeCount dependency (signal might not change)
    // so we force a re-render with a local state bump
    setLoading(v => !v); // harmless toggle to trigger re-render
    setLoading(v => !v);
  };

  /* ---- helpers ---- */
  const isRecording = isRunning();

  return (
    <section class="panel" aria-labelledby="h-backup">
      <div class="phead">
        <h2 id="h-backup">{t('backup.title')}</h2>
      </div>
      <div class="pbody">

        {/* Storage status card */}
        <div class="backup-storage-card">
          {storageInfo ? (
            <>
              <p class="note">
                {t('backup.storageStatus', {
                  used: storageInfo.usedMb.toString(),
                  quota: storageInfo.quotaMb.toString(),
                  pct: storageInfo.pct.toString(),
                })}
              </p>
              <div class="segbar segbar-sm">
                <div
                  style={{
                    width: `${Math.min(storageInfo.pct, 100)}%`,
                    background: storageInfo.pct > 80 ? 'var(--red)' : 'var(--amber)',
                  }}
                />
              </div>
              {storageInfo.persisted === true ? (
                <p class="note c-ok">{t('backup.storagePersisted')}</p>
              ) : (
                <p class="note c-warn">{t('backup.storageVolatile')}</p>
              )}
              {storageInfo.persisted !== true && (
                <button
                  class="btn btn-sm"
                  type="button"
                  onClick={onPersist}
                >
                  {t('backup.persistRequest')}
                </button>
              )}
            </>
          ) : (
            <p class="note">{dbOk.value ? '…' : t('export.notStored')}</p>
          )}
        </div>

        {/* Backup / Restore buttons */}
        <div class="flex flex-col gap-2">
          <button
            class="btn"
            type="button"
            disabled={isRecording || loading}
            onClick={() => void downloadBackup()}
          >
            {t('backup.create')}
          </button>

          <button
            class="btn"
            type="button"
            disabled={isRecording || loading || step.kind === 'restoring'}
            onClick={() => fileRef.current?.click()}
          >
            {t('backup.restore')}
          </button>
          {/* Hidden file input */}
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={onFileChange}
          />
        </div>

        {/* Loading indicator */}
        {loading && <p class="note" aria-live="polite">…</p>}

        {/* Error state */}
        {step.kind === 'error' && (
          <div class="save-fail-alert" role="alert">
            <span>{step.msg}</span>
            <button class="btn btn-sm" type="button" onClick={() => setStep({ kind: 'idle' })}>
              {t('backup.cancelBtn')}
            </button>
          </div>
        )}

        {/* Restore preview / confirmation */}
        {step.kind === 'preview' && (
          <div class="backup-preview" role="region" aria-labelledby="h-restore-preview">
            <h3 id="h-restore-preview" class="backup-preview-title">{t('backup.summaryTitle')}</h3>

            {/* Backup metadata */}
            <p class="note mono">
              {t('backup.createdAt', { d: new Date(step.backup.manifest.createdAt).toLocaleString() })}
              {' · '}
              {t('backup.takes', { n: step.backup.manifest.takeCount.toString() })}
              {' · '}
              {t('backup.voiced', { m: num(step.backup.manifest.voicedSeconds / 60) })}
            </p>

            {/* Unknown version warning */}
            {step.preview.unknownVersion && (
              <p class="note c-warn">{t('backup.unknownVersion')}</p>
            )}

            {/* Diff counts */}
            {step.backup.takes.length === 0 ? (
              <p class="note">{t('backup.summaryNone')}</p>
            ) : (
              <ul class="backup-summary-list">
                {step.preview.added > 0 && (
                  <li class="c-ok">{t('backup.summaryAdded', { n: step.preview.added.toString() })}</li>
                )}
                {step.preview.replaced > 0 && (
                  <li class="c-warn">{t('backup.summaryReplaced', { n: step.preview.replaced.toString() })}</li>
                )}
                {step.preview.skipped > 0 && (
                  <li>{t('backup.summarySkipped', { n: step.preview.skipped.toString() })}</li>
                )}
              </ul>
            )}

            <p class="note">{t('backup.confirmMsg')}</p>

            <div class="flex gap-2">
              <button
                class="btn"
                type="button"
                disabled={isRecording}
                onClick={() => void onConfirm()}
              >
                {t('backup.confirmBtn')}
              </button>
              <button
                class="btn btn-sm"
                type="button"
                onClick={() => setStep({ kind: 'idle' })}
              >
                {t('backup.cancelBtn')}
              </button>
            </div>
          </div>
        )}

        {/* Restoring spinner */}
        {step.kind === 'restoring' && (
          <p class="note" aria-live="polite" aria-busy="true">…</p>
        )}
      </div>
    </section>
  );
}
