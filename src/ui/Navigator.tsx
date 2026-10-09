import { useEffect, useRef } from 'preact/hooks';
import { takeKey } from '../analysis/qc';
import { CATEGORIES } from '../bank/types';
import { go } from '../app/controller';
import { bank, idx, settings, takes, totals } from '../app/store';
import { lt, num, t } from '../i18n';
import { pad3 } from '../lib/music';
import { catTarget } from './Header';

export function Navigator() {
  const S = settings.value;
  const tk = takes.value;
  const { byCat } = totals.value;
  const cur = idx.value;
  const B = bank.value;
  const listRef = useRef<HTMLDivElement>(null);
  let done = 0;
  for (const e of B) if (tk.has(takeKey(S.pass, e.id))) done++;

  useEffect(() => {
    // scroll only the list, never the page
    const box = listRef.current;
    const el = box?.querySelector<HTMLElement>(`[data-i="${cur}"]`);
    if (!box || !el) return;
    const top = el.offsetTop, bottom = top + el.offsetHeight;
    if (top < box.scrollTop) box.scrollTop = top - 8;
    else if (bottom > box.scrollTop + box.clientHeight) box.scrollTop = bottom - box.clientHeight + 8;
  }, [cur]);

  return (
    <nav class="panel nav" aria-label={t('nav.title')}>
      <div class="phead">
        <h2>{t('nav.title')}</h2>
        <span class="label">{done} / {B.length}</span>
      </div>
      <div class="nav-scroll" ref={listRef}>
        {CATEGORIES.map((c, ci) => {
          const target = catTarget(c, S.goal);
          const got = byCat[c] ?? 0;
          const items = B.map((e, i) => ({ e, i })).filter(x => x.e.cat === c);
          if (!items.length) return null;
          return (
            <div class="grp" key={c} style={{ '--c': `var(--cat${ci + 1})` }}>
              <div class="grp-h">
                <div class="row">
                  <span class="nm"><span class="sw" />{t(`cats.${c}`)}</span>
                  <span class="mm">{t('nav.catMinutes', { done: num(got / 60), target: num(target) })}</span>
                </div>
                <div class="mini"><div style={{ width: Math.min(100, (got / (target * 60 || 1)) * 100) + '%' }} /></div>
              </div>
              <ul class="ex-list" role="list">
                {items.map(({ e, i }) => {
                  const take = tk.get(takeKey(S.pass, e.id));
                  const cls = !take ? '' : take.external ? ' ext' : take.q === 'warn' || take.q === 'bad' ? ' warnq' : ' done';
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        class={'ex-item' + cls + (i === cur ? ' active' : '')}
                        data-i={i}
                        aria-current={i === cur ? 'true' : undefined}
                        onClick={() => go(i)}
                      >
                        <span class="no">{pad3(e.n)}</span>
                        <span class="tt">{lt(e.title)}{e.titleNote ? ' · ' + e.titleNote : ''}</span>
                        <span class="st" aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
