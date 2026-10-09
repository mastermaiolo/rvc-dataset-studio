import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { presetRange, VOICE_PRESETS } from '../src/bank/calibrate';
import { ABOVE, BELOW, FALSETTO_ABOVE, compileBank } from '../src/bank/compile';
import type { RawBank, RawLangPack } from '../src/bank/types';
import tipsEn from '../src/i18n/tips.en.json';

const packs: RawLangPack[] = fs.readdirSync('content/langs').map(d => JSON.parse(fs.readFileSync(`content/langs/${d}/pack.json`, 'utf8')));
const core = JSON.parse(fs.readFileSync('content/bank/core.json', 'utf8')) as RawBank;

describe('language packs', () => {
  it('ships English, Portuguese (Brazil), Spanish and Mandarin', () => {
    expect(packs.map(p => p.id).sort()).toEqual(['en', 'es', 'pt-BR', 'zh']);
  });

  it.each(packs.map(p => [p.id, p] as const))('%s: has speech, phonemes and a voice-test sentence', (_id, p) => {
    const cats = new Set(p.exercises.map(e => e.cat));
    expect(cats.has('phonemes')).toBe(true);
    expect(p.voiceTest?.speech.length).toBeGreaterThan(10);
    if (p.script === 'latin') {
      expect(p.exercises.filter(e => e.mode === 'speech' && e.cat === 'speech').length).toBeGreaterThanOrEqual(15);
      expect(p.exercises.some(e => e.mode === 'melody')).toBe(true);
    }
  });

  it.each(packs.map(p => [p.id, p] as const))('%s: every tip exists and every text has English and pt-BR', (_id, p) => {
    for (const e of p.exercises) {
      expect(p.tips?.[e.tip] ?? (tipsEn as Record<string, string>)[e.tip], e.id).toBeTruthy();
      for (const k of ['reg', 'emo', 'sub', 'title'] as const) {
        const v = e[k];
        if (v) {
          expect(v.en, `${e.id}.${k}`).toBeTruthy();
          expect(v['pt-BR'], `${e.id}.${k}`).toBeTruthy();
        }
      }
    }
  });

  it.each(Object.keys(VOICE_PRESETS) as (keyof typeof VOICE_PRESETS)[])('every pack fits the %s range', v => {
    const c = { ...presetRange(v), toneBase: presetRange(v).low };
    for (const p of packs) {
      const b = compileBank([core, p], c);
      for (const e of b) {
        if (e.mode === 'tones') continue;
        const hiLim = e.rg === 'falsetto' ? c.high + FALSETTO_ABOVE : c.high + ABOVE;
        for (const s of e.syl) for (const m of s.f ?? []) {
          expect(m).toBeGreaterThanOrEqual(c.low - BELOW);
          expect(m).toBeLessThanOrEqual(hiLim);
        }
      }
    }
  });

  it('keeps ids unique across all packs', () => {
    const ids = [core, ...packs].flatMap(p => p.exercises.map(e => e.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
