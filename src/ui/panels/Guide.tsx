import { t, tList } from '../../i18n';
import { Rich } from '../rich';

const SECTIONS = [
  ['guide.before', 'guide.beforeItems', 'ul'],
  ['guide.timbre', 'guide.timbreItems', 'ul'],
  ['guide.conversion', 'guide.conversionItems', 'ul'],
  ['guide.training', 'guide.trainingItems', 'ol'],
] as const;

export function GuidePanel() {
  return (
    <details class="panel">
      <summary>{t('guide.title')}</summary>
      <div class="pbody guide pt-0">
        {SECTIONS.map(([h, items, List]) => (
          <div key={h}>
            <h3>{t(h)}</h3>
            <List>{tList(items).map((x, i) => <li key={i}><Rich text={x} /></li>)}</List>
          </div>
        ))}
      </div>
    </details>
  );
}
