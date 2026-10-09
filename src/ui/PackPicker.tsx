import { togglePack } from '../app/controller';
import { bank, packs, PACKS } from '../app/store';
import { lt, t } from '../i18n';

/** Checkboxes for the speech-language packs in the session bank. */
export function PackPicker({ id }: { id: string }) {
  const on = packs.value;
  const count = (pid: string) => bank.value.filter(e => e.source === pid).length;
  return (
    <fieldset class="packs" aria-describedby={id + '-hint'}>
      {PACKS.map(p => (
        <label key={p.id} class={'pack' + (on.includes(p.id) ? ' on' : '')}>
          <input type="checkbox" checked={on.includes(p.id)} onChange={e => togglePack(p.id, (e.target as HTMLInputElement).checked)} />
          <span lang={p.id}>{lt(p.name)}</span>
          {on.includes(p.id) && <small>{t('packs.exercises', { n: count(p.id) })}</small>}
        </label>
      ))}
    </fieldset>
  );
}
