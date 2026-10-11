import { describe, expect, it } from 'vitest';

/**
 * WCAG 2.2 AA contrast ratio tests for the RVC Dataset Studio color system.
 * Normal text: >= 4.5:1, Large text (>= 18pt or 14pt bold): >= 3:1
 */

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function luminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(fg: string, bg: string): number {
  const [r1, g1, b1] = hexToRgb(fg);
  const [r2, g2, b2] = hexToRgb(bg);
  const l1 = luminance(r1, g1, b1);
  const l2 = luminance(r2, g2, b2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Color tokens from app.css
const colors = {
  bg: '#0B0F14',
  panel: '#121922',
  panel2: '#18212D',
  panel3: '#1E2938',
  text: '#E8EDF4',
  muted: '#8D9AAF',
  faint: '#7A879C',
  amber: '#F4B042',
  amberHi: '#FFD68C',
  amberInk: '#1C1304',
  rec: '#FF4D5E',
  ok: '#3DD49B',
  warn: '#F6C75A',
  bad: '#FF6470',
  line: '#223043',
  line2: '#6B7F99',
};

describe('WCAG AA contrast — text on backgrounds', () => {
  it('main text on bg passes AA (4.5:1)', () => {
    expect(contrastRatio(colors.text, colors.bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('main text on panel passes AA (4.5:1)', () => {
    expect(contrastRatio(colors.text, colors.panel)).toBeGreaterThanOrEqual(4.5);
  });

  it('main text on panel2 passes AA (4.5:1)', () => {
    expect(contrastRatio(colors.text, colors.panel2)).toBeGreaterThanOrEqual(4.5);
  });

  it('muted text on panel passes AA (4.5:1)', () => {
    expect(contrastRatio(colors.muted, colors.panel)).toBeGreaterThanOrEqual(4.5);
  });

  it('muted text on panel2 passes AA (4.5:1)', () => {
    expect(contrastRatio(colors.muted, colors.panel2)).toBeGreaterThanOrEqual(4.5);
  });

  it('faint text on panel passes AA for large text (3:1)', () => {
    expect(contrastRatio(colors.faint, colors.panel)).toBeGreaterThanOrEqual(3.0);
  });

  it('amber text on panel passes AA (4.5:1)', () => {
    expect(contrastRatio(colors.amber, colors.panel)).toBeGreaterThanOrEqual(4.5);
  });

  it('amber ink on amber passes AA (4.5:1)', () => {
    expect(contrastRatio(colors.amberInk, colors.amber)).toBeGreaterThanOrEqual(4.5);
  });

  it('ok text on panel passes AA (4.5:1)', () => {
    expect(contrastRatio(colors.ok, colors.panel)).toBeGreaterThanOrEqual(4.5);
  });

  it('warn text on panel passes AA (4.5:1)', () => {
    expect(contrastRatio(colors.warn, colors.panel)).toBeGreaterThanOrEqual(4.5);
  });

  it('bad text on panel passes AA (4.5:1)', () => {
    expect(contrastRatio(colors.bad, colors.panel)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('WCAG AA contrast — interactive elements', () => {
  it('line2 border on panel passes AA for UI components (3:1)', () => {
    expect(contrastRatio(colors.line2, colors.panel)).toBeGreaterThanOrEqual(3.0);
  });

  it('amber focus ring on bg passes AA (3:1)', () => {
    expect(contrastRatio(colors.amber, colors.bg)).toBeGreaterThanOrEqual(3.0);
  });
});
