import { useRef, useState } from 'preact/hooks';
import { addLyrics, clearLyrics, removeLyric } from '../../app/controller';
import { lyrics, toast } from '../../app/store';
import { t, tn } from '../../i18n';
import type { LyricLang } from '../../lyrics/syllables';
import { Rich } from '../rich';

const LANGS: LyricLang[] = ['en', 'pt', 'es', 'zh', 'other'];
const PER_LINE = 4;

export function LyricsPanel() {
  const [text, setText] = useState('');
  const [lang, setLang] = useState<LyricLang>('en');
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const lines = lyrics.value;

  const add = () => {
    const n = addLyrics(text, lang);
    if (n) {
      setText('');
      toast(tn('lyrics.added', n, { x: n * PER_LINE }));
    } else toast(t('lyrics.none'));
  };
  const onClear = () => {
    if (!armed) {
      setArmed(true);
      timer.current = setTimeout(() => setArmed(false), 4000);
      return;
    }
    clearTimeout(timer.current);
    setArmed(false);
    clearLyrics();
  };

  return (
    <details class="panel" open={lines.length === 0 ? undefined : true}>
      <summary>{t('lyrics.title')}</summary>
      <div class="pbody pt-0">
        <p class="note mt-0">{t('lyrics.intro')}</p>
        <div class="field">
          <label for="lyLang">{t('lyrics.lang')}</label>
          <div>
            <select id="lyLang" value={lang} onChange={e => setLang((e.target as HTMLSelectElement).value as LyricLang)}>
              {LANGS.map(l => <option key={l} value={l}>{t(`lyrics.langs.${l}`)}</option>)}
            </select>
          </div>
        </div>
        {lang === 'zh' && <p class="note"><Rich text={t('lyrics.zhHint')} /></p>}
        <textarea
          class="ly-text"
          rows={4}
          aria-label={t('lyrics.title')}
          placeholder={t('lyrics.placeholder')}
          value={text}
          lang={lang === 'other' ? undefined : lang}
          onInput={e => setText((e.target as HTMLTextAreaElement).value)}
        />
        <div class="row-btns">
          <button class="btn btn-sm btn-accept" type="button" disabled={!text.trim()} onClick={add}>{t('lyrics.add')}</button>
        </div>
        <p class="note">{t('lyrics.local')}</p>
        {lines.length > 0 && (
          <>
            <p class="label ly-count">{t('lyrics.count', { n: lines.length, x: lines.length * PER_LINE })}</p>
            <ul class="ly-list">
              {lines.map(l => (
                <li key={l.id}>
                  <span class="ly-line" lang={l.lang === 'other' ? undefined : l.lang}>{l.text}</span>
                  <button class="btn btn-sm" type="button" aria-label={t('lyrics.removeAria', { t: l.text.slice(0, 40) })} onClick={() => removeLyric(l.id)}>
                    {t('lyrics.remove')}
                  </button>
                </li>
              ))}
            </ul>
            <div class="row-btns">
              <button class={'btn btn-sm' + (armed ? ' active' : '')} type="button" onClick={onClear}>{armed ? t('lyrics.clearConfirm') : t('lyrics.clear')}</button>
            </div>
          </>
        )}
      </div>
    </details>
  );
}
