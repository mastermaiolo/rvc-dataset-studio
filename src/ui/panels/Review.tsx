import { useEffect, useRef } from 'preact/hooks';
import { qcList, worst, type QCItem, type Take } from '../../analysis/qc';
import { downloadTake, retrySaveTake, shownTake, togglePlay } from '../../app/controller';
import { current, pending, playing, settings, takes } from '../../app/store';
import { num, t } from '../../i18n';
import { midiToNote, signedCents } from '../../lib/music';
import { takeFileName } from '../../export/dataset';
import { onResize, prepCanvas, token } from '../canvas';
import { Rich } from '../rich';

function drawWave(c: HTMLCanvasElement, x: Float32Array): void {
  const { g, w, h } = prepCanvas(c, 76);
  const amber = token('--amber') || '#F4B042', red = token('--rec') || '#FF4D5E';
  g.fillStyle = token('--line2') || '#2E3E57';
  g.fillRect(0, h / 2, w, 1);
  const step = Math.max(1, Math.floor(x.length / w));
  for (let px = 0; px < w; px++) {
    let mn = 1, mx = -1;
    const a = px * step, b = Math.min(x.length, a + step);
    for (let i = a; i < b; i++) { const v = x[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
    if (mx < mn) continue;
    g.fillStyle = mx >= 0.99 || mn <= -0.99 ? red : amber;
    const y1 = h / 2 - ((mx * h) / 2) * 0.95, y2 = h / 2 - ((mn * h) / 2) * 0.95;
    g.fillRect(px, y1, 1, Math.max(1, y2 - y1));
  }
}

function qcValue(q: QCItem): string {
  const v = q.v;
  switch (q.k) {
    case 'origin': return v.rehearsal ? t('qc.originRehearsal') : t('qc.originExternal');
    case 'estimated':
    case 'voiced':
    case 'duration': return num(v.sec as number) + ' s';
    case 'peak': return num(v.db as number) + ' dBFS' + (v.clip ? t('qc.clip') : '');
    case 'floor': return v.none ? t('qc.floorNone') : (v.db as number) < -120 ? '< ' + num(-120, 0) + ' dBFS' : num(v.db as number, 0) + ' dBFS';
    case 'tuning':
      if (v.kind === 'off') return t('qc.off');
      if (v.kind === 'none') return t('qc.none');
      return t('qc.cents', { c: signedCents(v.signed as number), p: Math.round((v.within as number) * 100) });
    case 'span':
      return t('qc.spanVal', { lo: midiToNote(v.lo as number), hi: midiToNote(v.hi as number), tlo: midiToNote(v.tlo as number), thi: midiToNote(v.thi as number) });
  }
}

export function ReviewPanel() {
  // subscribe to what shownTake() reads
  void pending.value; void takes.value; void current.value; void settings.value.pass;
  const tk: Take | null = shownTake();
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !tk?.pcm) return;
    const pcm = tk.pcm;
    drawWave(c, pcm);
    return onResize(c, () => drawWave(c, pcm));
  }, [tk]);
  const L = tk ? qcList(tk) : [];
  const w = worst(L);
  return (
    <section class="panel" aria-labelledby="h-review">
      <div class="phead">
        <h2 id="h-review">{pending.value ? t('review.pending') : tk ? t('review.accepted') : t('review.title')}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {tk?.saveStatus === 'saved' && (
            <span class="save-badge save-badge-ok">{t('review.savedLocal')}</span>
          )}
          {tk?.saveStatus === 'saving' && (
            <span class="save-badge save-badge-busy">{t('review.savingLocal')}</span>
          )}
          <span class="label">{tk ? takeFileName(tk) : ''}</span>
        </div>
      </div>
      <div class="pbody">
        <canvas class="wave" ref={ref} hidden={!tk?.pcm} role="img" aria-label={t('review.waveAria')} />
        {tk?.saveStatus === 'failed' && (
          <div class="save-fail-alert" role="alert">
            <span>{t('review.saveFailWarning')}</span>
            <button class="btn btn-sm btn-warn" type="button" onClick={() => void retrySaveTake(tk)}>
              {t('review.retrySave')}
            </button>
          </div>
        )}
        {!tk && <div class="empty">{t('review.empty')}</div>}
        {tk && (
          <>
            <ul class="qc" aria-label={t('review.qcAria')}>
              {L.map(x => (
                <li class="chip" key={x.k}>
                  <span class="k"><i class={'bg-' + x.s} aria-hidden="true" />{t(`qc.${x.k}`)}</span>
                  <span class={'v c-' + x.s}>{qcValue(x)}</span>
                </li>
              ))}
            </ul>
            <div class={'verdict v-' + (tk.external ? 'ext' : w)}>
              <Rich text={tk.external ? t('verdict.external') : t(`verdict.${w}`)} />
            </div>
          </>
        )}
        <div class="row-btns">
          <button class="btn btn-sm" type="button" disabled={!tk?.pcm} onClick={togglePlay}>{playing.value ? t('review.stop') : t('review.play')}</button>
          <button class="btn btn-sm" type="button" disabled={!tk?.pcm} onClick={downloadTake}>{t('review.wav')}</button>
        </div>
      </div>
    </section>
  );
}
