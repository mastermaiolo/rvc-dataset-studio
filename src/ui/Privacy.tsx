import { useEffect, useRef } from 'preact/hooks';
import { locale, t, tList, type MessageKey } from '../i18n';
import { Rich } from './rich';

const SECTIONS = ['what', 'notDone', 'hosting', 'control', 'consent', 'contact'] as const;
/** Date of the last change to this text (update when the policy changes). */
const UPDATED = '2026-09-28';

export function Privacy() {
  const h = useRef<HTMLHeadingElement>(null);
  useEffect(() => { h.current?.focus(); window.scrollTo(0, 0); }, []);
  const date = new Date(UPDATED + 'T12:00:00Z').toLocaleDateString(locale.value, { year: 'numeric', month: 'long', day: 'numeric' });
  return (
    <main class="layout-ob privacy" id="prompter">
      <article class="panel">
        <div class="pbody">
          <a class="back" href="#">{t('privacy.back')}</a>
          <h1 class="ob-title" tabIndex={-1} ref={h}>{t('privacy.title')}</h1>
          <p class="note">{t('privacy.updated', { d: date })}</p>
          <p class="ob-intro"><Rich text={t('privacy.summary')} /></p>
          {SECTIONS.map(s => (
            <section key={s}>
              <h2>{t(`privacy.sections.${s}.h` as MessageKey)}</h2>
              <ul>{tList(`privacy.sections.${s}.items` as MessageKey).map((x, i) => <li key={i}><Rich text={x} /></li>)}</ul>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
