import { beforeEach, describe, expect, it } from 'vitest';
import tipsEn from '../src/i18n/tips.en.json';
import tipsPt from '../src/i18n/tips.pt-BR.json';
import { detectLocale, locale, lt, num, t, tList, tn } from '../src/i18n';

describe('locales', () => {
  it('detects the browser language and falls back to English', () => {
    expect(detectLocale(['pt-BR', 'en'])).toBe('pt-BR');
    expect(detectLocale(['pt-PT'])).toBe('pt-BR');
    expect(detectLocale(['fr-FR', 'de'])).toBe('en');
    expect(detectLocale(['en-GB'])).toBe('en');
    expect(detectLocale([])).toBe('en');
  });
  it('has the same tips in every interface language', () => {
    expect(Object.keys(tipsPt).sort()).toEqual(Object.keys(tipsEn).sort());
  });
  it('switches strings with the locale', () => {
    locale.value = 'en';
    expect(t('btn.rec')).toBe('Record');
    expect(num(1.5)).toBe('1.5');
    locale.value = 'pt-BR';
    expect(t('btn.rec')).toBe('Gravar');
    expect(num(1.5)).toBe('1,5');
  });
});

describe('i18n (pt-BR)', () => {
  beforeEach(() => { locale.value = 'pt-BR'; });
  it('interpolates parameters', () => {
    expect(t('header.exerciseOf', { n: 3, total: 10 })).toBe('Exercício 3 de 10');
  });
  it('returns the key for unknown messages and lists for arrays', () => {
    expect(t('nope.nothing' as never)).toBe('nope.nothing');
    expect(tList('guide.trainingItems').length).toBeGreaterThan(2);
  });
  it('chooses plural forms', () => {
    expect(tn('toast.recovered', 1)).toBe('1 take recuperado desta sessão.');
    expect(tn('toast.recovered', 4)).toBe('4 takes recuperados desta sessão.');
  });
  it('picks the best localized content string', () => {
    expect(lt({ en: 'Calm', 'pt-BR': 'Calmo' })).toBe('Calmo');
    expect(lt({ en: 'Calm' })).toBe('Calm');
    locale.value = 'en';
    expect(lt({ en: 'Calm', 'pt-BR': 'Calmo' })).toBe('Calm');
    locale.value = 'pt-BR';
    expect(lt({ pt: 'Calmo' })).toBe('Calmo');
    expect(lt('plain')).toBe('plain');
  });
  it('formats decimals for the locale', () => {
    expect(num(1.25, 1)).toMatch(/^1[,.]3$|^1[,.]2$/);
    expect(num(-2, 1)).toBe('−2,0');
  });
  it('keeps the corrected Applio advice', () => {
    const conv = tList('guide.conversionItems').join(' ');
    expect(conv).toMatch(/0,5 desliga/);
    expect(conv).toMatch(/não controla a melodia/);
    expect(conv).toMatch(/1,0/);
    expect(tList('guide.trainingItems').join(' ')).toMatch(/de ouvido/);
  });
});
