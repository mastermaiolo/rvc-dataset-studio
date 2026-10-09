import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { coverage, registerMix, REGISTER_TARGETS, summarize, tuningClass } from '../../analysis/coverage';
import { bank, settings, span, takes, update } from '../../app/store';
import type { RegisterId } from '../../bank/types';
import { locale, num, t, type MessageKey } from '../../i18n';
import { midiToNote } from '../../lib/music';
import { onResize, prepCanvas, token } from '../canvas';

export function CoveragePanel() {
  const range = settings.value.range;
  const b = span.value;
  const cov = useMemo(() => coverage(takes.value.values()), [takes.value]);
  const { agg, sung, spoken } = cov;
  const keys = Object.keys(agg).map(Number).filter(m => agg[m].s + agg[m].f > 0.05);
  const lo = Math.max(36, Math.min(range.low, b.lo, ...keys) - 1);
  const hi = Math.min(96, Math.max(range.high, b.hi, ...keys) + 1);
  const ref = useRef<HTMLCanvasElement>(null);
  const [focus, setFocus] = useState<number | null>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const draw = () => {
      const { g, w, h } = prepCanvas(c, 150);
      const n = hi - lo + 1, padB = 30, padT = 6, bw = w / n;
      const maxV = Math.max(1, ...keys.map(m => agg[m].s + agg[m].f));
      const fy = (v: number) => ((h - padB - padT) * v) / maxV;
      g.fillStyle = token('--panel2');
      g.fillRect((range.low - lo) * bw, padT, (range.high - range.low + 1) * bw, h - padB - padT);
      g.font = '10px ' + (token('--f-mono') || 'monospace');
      const base = h - padB;
      for (let m = lo; m <= hi; m++) {
        const a = agg[m], x = (m - lo) * bw + 1, bwi = Math.max(1, bw - 2);
        if (a) {
          const hf = fy(a.f), hs = fy(a.s);
          if (hf > 0) { g.fillStyle = token('--fala'); g.fillRect(x, base - hf, bwi, hf); }
          if (hs > 0) {
            g.fillStyle = token('--amber');
            const y = base - hf - hs - (hf > 0 ? 2 : 0);
            g.beginPath();
            if (g.roundRect) g.roundRect(x, y, bwi, hs, [3, 3, 0, 0]); else g.rect(x, y, bwi, hs);
            g.fill();
          }
          if (a.n >= 20) {
            g.fillStyle = token('--' + tuningClass(a));
            g.beginPath(); g.arc(x + bwi / 2, base + 7, Math.min(3.5, bw / 2.5), 0, Math.PI * 2); g.fill();
          }
        }
        if (m === focus) { g.strokeStyle = token('--amber'); g.strokeRect(x - 1, padT, bwi + 2, base - padT); }
        if (m % 12 === 0 || m === range.low || m === range.high) {
          g.fillStyle = m === range.low || m === range.high ? token('--text') : token('--faint');
          g.fillText(midiToNote(m), x - 2, h - 4);
        }
      }
      // Label drawn last, on its own backdrop, so the bars never cover it.
      const label = t('coverage.yourRange'), lx = (range.low - lo) * bw + 3;
      g.fillStyle = token('--panel2');
      g.fillRect(lx - 2, padT + 1, g.measureText(label).width + 4, 12);
      g.fillStyle = token('--faint');
      g.fillText(label, lx, padT + 10);
      g.fillStyle = token('--line2');
      g.fillRect(0, base, w, 1);
      c.onmousemove = e => {
        const r = c.getBoundingClientRect();
        setFocus(Math.max(lo, Math.min(hi, lo + Math.floor((e.clientX - r.left) / bw))));
      };
      c.onmouseleave = () => setFocus(null);
    };
    draw();
    return onResize(c, draw);
  }, [cov, lo, hi, range.low, range.high, focus, locale.value]);

  const readout = (m: number) => {
    const a = agg[m];
    if (!a) return t('coverage.readNone', { n: midiToNote(m) });
    return t('coverage.read', { n: midiToNote(m), s: num(a.s), f: num(a.f) }) + (a.n >= 20 ? t('coverage.readTune', { c: (a.c / a.n).toFixed(0) }) : '');
  };

  const sm = summarize(cov, range);
  const out: string[] = [];
  if (!sm.enoughData) out.push(t('coverage.needMore'));
  else {
    out.push(sm.gaps.length ? t('coverage.gaps', { list: sm.gaps.slice(0, 7).map(midiToNote).join(', ') + (sm.gaps.length > 7 ? '…' : '') }) : t('coverage.full'));
    if (sm.aboveSec > 1) out.push(t('coverage.above', { s: num(sm.aboveSec) }));
    if (sm.belowSec > 1) out.push(t('coverage.below', { s: num(sm.belowSec) }));
    if (sm.weakest) out.push(t('coverage.weakest', { n: midiToNote(sm.weakest.midi), c: sm.weakest.cents.toFixed(0) }));
  }
  if (sm.speechMedian != null) out.push(t('coverage.speech', { n: midiToNote(sm.speechMedian) }));

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const f = focus ?? range.low;
    setFocus(Math.max(lo, Math.min(hi, f + (e.key === 'ArrowRight' ? 1 : -1))));
  };

  const mix = useMemo(() => registerMix(takes.value.values(), bank.value), [takes.value, bank.value]);
  const registers: RegisterId[] = ['chest', 'mixed', 'falsetto', 'speech'];

  return (
    <section class="panel" aria-labelledby="h-cov">
      <div class="phead">
        <h2 id="h-cov">{t('coverage.title')}</h2>
        <span class="label">{t('coverage.total', { s: num(sung / 60), f: num(spoken / 60) })}</span>
      </div>
      <div class="pbody">
        <div class="legend">
          <span><i class="sw" style={{ background: 'var(--amber)' }} />{t('coverage.sung')}</span>
          <span><i class="sw" style={{ background: 'var(--fala)' }} />{t('coverage.spoken')}</span>
          <span><i class="dotk bg-ok" /><i class="dotk bg-warn" /><i class="dotk bg-bad" />{t('coverage.tuningLegend')}</span>
        </div>
        <canvas
          class="cov"
          ref={ref}
          tabIndex={0}
          role="img"
          aria-label={t('coverage.aria')}
          onKeyDown={onKey}
          onFocus={() => focus == null && setFocus(range.low)}
          onBlur={() => setFocus(null)}
        />
        <div class="note mono" aria-live="polite">{focus != null ? readout(focus) : t('coverage.hover')}</div>
        <p class="note">{out.join(' ')}</p>
        <div class="mix-section">
          <h3 class="mix-h">{t('coverage.mixTitle')}</h3>
          <p class="mix-help">{t('coverage.mixHelp')}</p>
          {registers.map(reg => {
            const tgt = REGISTER_TARGETS[reg];
            const pct = mix.percentages[reg] || 0;
            return (
              <div class="mix-row" key={reg}>
                <div class="mix-lbl">
                  <strong>{t(('coverage.registers.' + reg) as MessageKey)}</strong>
                  <span>{t(('coverage.registerTips.' + reg) as MessageKey)}</span>
                </div>
                <div class="mix-bar">
                  <div
                    class="mix-tgt"
                    style={{ left: `${tgt.lo}%`, width: `${tgt.hi - tgt.lo}%` }}
                    title={`Target: ${tgt.lo}–${tgt.hi}%`}
                  />
                  <div
                    class="mix-fill"
                    style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: `var(${tgt.colorVar})` }}
                  />
                </div>
                <div class="mix-val">
                  {t('coverage.targetRange', { cur: pct.toFixed(0), lo: tgt.lo.toString(), hi: tgt.hi.toString() })}
                </div>
              </div>
            );
          })}
          {mix.warnings.length > 0 && (
            <div class="mix-warn-box" role="alert">
              {mix.warnings.map(w => (
                <div class="mix-warn-pill" key={w}>
                  <span>{t(w as MessageKey)}</span>
                </div>
              ))}
              {mix.suggestedExerciseId && (
                <button
                  class="mix-btn-jump"
                  type="button"
                  onClick={() => update({ cur: mix.suggestedExerciseId! })}
                >
                  {t('coverage.recordSuggested', { id: mix.suggestedExerciseId })}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
