import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { mic, settings, toastMsg } from './store';
import { t, type MessageKey } from '../i18n';
import { Header } from '../ui/Header';
import { Navigator } from '../ui/Navigator';
import { Prompter } from '../ui/Prompter';
import { ProfilePanel } from '../ui/panels/Profile';
import { TunerPanel } from '../ui/panels/Tuner';
import { ReviewPanel } from '../ui/panels/Review';
import { CoveragePanel } from '../ui/panels/Coverage';
import { ExportPanel } from '../ui/panels/Export';
import { SettingsPanel } from '../ui/panels/Settings';
import { GuidePanel } from '../ui/panels/Guide';
import { Rich } from '../ui/rich';
import { Onboarding } from '../ui/Onboarding';
import { LyricsPanel } from '../ui/panels/Lyrics';
import { Privacy } from '../ui/Privacy';

/** Minimal hash routing: #privacy shows the privacy page, anything else the app. */
const route = signal(typeof location !== 'undefined' ? location.hash : '');
if (typeof window !== 'undefined') window.addEventListener('hashchange', () => { route.value = location.hash; });

function Banner() {
  const m = mic.value;
  let text = '';
  if (m.status === 'blocked') {
    if (m.error === 'insecure') text = t('banner.insecure');
    else if (m.error === 'unsupported') text = t('banner.unsupported');
    else text = t('banner.blocked', { name: m.error ? ' (' + m.error + ')' : '' });
  }
  if (!text && m.status === 'ready' && m.forced?.length)
    text = t('banner.processing', { list: m.forced.map(k => t(`banner.proc.${k}` as MessageKey)).join(', ') });
  if (!text) return null;
  return <div class="banner" role="alert"><span><Rich text={text} /></span></div>;
}

function Toast() {
  const m = toastMsg.value;
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!m) return;
    setOn(true);
    const id = setTimeout(() => setOn(false), 3200);
    return () => clearTimeout(id);
  }, [m?.id]);
  return <div class={'toast' + (on ? ' on' : '')} role="status" aria-live="polite">{m?.text}</div>;
}

export function App() {
  return (
    <>
      <a class="skip" href="#prompter">{t('app.skip')}</a>
      <div class="app">
        <Header />
        <Banner />
        {route.value === '#privacy' ? (
          <Privacy />
        ) : settings.value.onboarded ? (
          <main class="layout">
            <Navigator />
            <Prompter />
            <aside class="side">
              <ProfilePanel />
              <TunerPanel />
              <ReviewPanel />
              <CoveragePanel />
              <LyricsPanel />
              <ExportPanel />
              <SettingsPanel />
              <GuidePanel />
            </aside>
          </main>
        ) : (
          <main class="layout-ob" id="prompter">
            <Onboarding />
            <GuidePanel />
          </main>
        )}
        <footer class="foot">
          <span>{t('footer.local')}</span>
          <span>{t('footer.affiliation')}</span>
          <span>{t('footer.source')}</span>
          <a href="#privacy">{t('privacy.link')}</a>
        </footer>
      </div>
      <Toast />
    </>
  );
}
