import { dom } from '../../app/live';
import { mic } from '../../app/store';
import { t } from '../../i18n';

export function TunerPanel() {
  return (
    <section class="panel" aria-labelledby="h-tuner">
      <div class="phead">
        <h2 id="h-tuner">{t('tuner.title')}</h2>
        <span class="label">{mic.value.status === 'ready' ? t('tuner.live') : t('tuner.noMic')}</span>
      </div>
      <div class="pbody" aria-hidden="true">
        <div class="tu-read">
          <span class="tu-note" ref={el => { dom.tuNote = el; }}>—</span>
          <span class="tu-cents" ref={el => { dom.tuCents = el; }} />
        </div>
        <div class="tu-scale">
          <div class="tu-zone" />
          <div class="tu-mid" />
          <div class="tu-needle" ref={el => { dom.tuNeedle = el; }} />
        </div>
        <div class="tu-lab"><span>−50¢</span><span>−25</span><span>0</span><span>+25</span><span>+50¢</span></div>
        <div class="tu-meta">
          <span ref={el => { dom.tuTarget = el; }}>{t('tuner.targetNone')}</span>
          <span ref={el => { dom.tuHz = el; }}>— Hz</span>
        </div>
      </div>
    </section>
  );
}
