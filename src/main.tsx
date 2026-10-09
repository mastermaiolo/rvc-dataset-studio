import { effect } from '@preact/signals';
import { render } from 'preact';
import '@fontsource/bricolage-grotesque/latin-500.css';
import '@fontsource/bricolage-grotesque/latin-700.css';
import '@fontsource/bricolage-grotesque/latin-800.css';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans/latin-ext-400.css';
import '@fontsource/ibm-plex-sans/latin-ext-500.css';
import '@fontsource/ibm-plex-sans/latin-ext-600.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import './styles/index.css';
import { App } from './app/App';
import { boot } from './app/controller';
import { settings } from './app/store';
import { engine } from './audio/engine';
import { locale } from './i18n';

effect(() => engine.setOutput(settings.value.vol, settings.value.muted));
effect(() => { document.documentElement.lang = locale.value; });

render(<App />, document.getElementById('app')!);
void boot();
