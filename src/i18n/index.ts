import { signal } from '@preact/signals';
import type { LText } from '../bank/types';
import { en } from './en';
import { ptBR } from './pt-BR';
import tipsEn from './tips.en.json';
import tipsPtBR from './tips.pt-BR.json';

/**
 * Tiny i18n layer: nested message dictionaries, `{param}` interpolation,
 * localized content objects (LText) and a reactive current locale.
 */

type Messages = { [k: string]: string | readonly string[] | Messages };
type Leaves<T> = {
  [K in keyof T & string]: T[K] extends string | readonly string[] ? K : `${K}.${Leaves<T[K]>}`;
}[keyof T & string];
export type MessageKey = Leaves<typeof en>;

export interface LocaleDef {
  id: string;
  name: string;
  messages: Messages;
  tips: Record<string, string>;
}

export const LOCALES: LocaleDef[] = [
  { id: 'en', name: 'English', messages: en as unknown as Messages, tips: tipsEn },
  { id: 'pt-BR', name: 'Português (Brasil)', messages: ptBR as unknown as Messages, tips: tipsPtBR },
];
export const FALLBACK = 'en';

/** Best supported locale for a list of browser languages (e.g. navigator.languages). */
export function detectLocale(prefs: readonly string[]): string {
  for (const p of prefs) {
    const exact = LOCALES.find(l => l.id.toLowerCase() === p.toLowerCase());
    if (exact) return exact.id;
    const base = LOCALES.find(l => l.id.split('-')[0] === p.split('-')[0].toLowerCase());
    if (base) return base.id;
  }
  return FALLBACK;
}

const LOCALE_KEY = 'rvcds.locale';
function initialLocale(): string {
  try {
    const saved = localStorage.getItem(LOCALE_KEY);
    if (saved && LOCALES.some(l => l.id === saved)) return saved;
  } catch {}
  return typeof navigator !== 'undefined' ? detectLocale(navigator.languages ?? [navigator.language]) : FALLBACK;
}

export const locale = signal<string>(initialLocale());

export function setLocale(id: string): void {
  if (!LOCALES.some(l => l.id === id)) return;
  locale.value = id;
  try { localStorage.setItem(LOCALE_KEY, id); } catch {}
}

const def = (id: string): LocaleDef => LOCALES.find(l => l.id === id) ?? LOCALES.find(l => l.id === FALLBACK)!;

function lookup(msgs: Messages, key: string): string | readonly string[] | undefined {
  let cur: unknown = msgs;
  for (const part of key.split('.')) {
    if (cur && typeof cur === 'object' && !Array.isArray(cur)) cur = (cur as Messages)[part];
    else return undefined;
  }
  return typeof cur === 'string' || Array.isArray(cur) ? (cur as string | readonly string[]) : undefined;
}

const fill = (s: string, p?: Record<string, string | number>): string =>
  p ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in p ? String(p[k]) : m)) : s;

/** Translated string for `key`, falling back to the base locale and finally to the key itself. */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const v = lookup(def(locale.value).messages, key) ?? lookup(def(FALLBACK).messages, key);
  return typeof v === 'string' ? fill(v, params) : key;
}

/** Plural-aware lookup: tries `${key}_${category}` (one, few, many, other…) for the count `n`. */
export function tn(key: string, n: number, params?: Record<string, string | number>): string {
  const cat = new Intl.PluralRules(locale.value).select(n);
  for (const k of [`${key}_${cat}`, `${key}_other`]) {
    const v = lookup(def(locale.value).messages, k) ?? lookup(def(FALLBACK).messages, k);
    if (typeof v === 'string') return fill(v, { n, ...params });
  }
  return key;
}

/** Translated list (guide bullets and similar). */
export function tList(key: MessageKey): string[] {
  const v = lookup(def(locale.value).messages, key) ?? lookup(def(FALLBACK).messages, key);
  return Array.isArray(v) ? [...v] : [];
}

export function tip(key: string): string {
  return def(locale.value).tips[key] ?? def(FALLBACK).tips[key] ?? '';
}

/** Picks the best string of a localized content object: current locale, its language, fallback, English, anything. */
export function lt(x: LText | string | undefined): string {
  if (x == null) return '';
  if (typeof x === 'string') return x;
  const l = locale.value;
  return x[l] ?? x[l.split('-')[0]] ?? Object.entries(x).find(([k]) => k.split('-')[0] === l.split('-')[0])?.[1] ?? x[FALLBACK] ?? x.en ?? Object.values(x)[0] ?? '';
}

/** Locale-aware decimal formatting (comma in pt-BR). */
export function num(x: number, digits = 1): string {
  return x.toLocaleString(locale.value, { minimumFractionDigits: digits, maximumFractionDigits: digits }).replace('-', '−');
}
