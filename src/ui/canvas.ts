/** Reads a CSS custom property (theme token) for canvas drawing. */
export const token = (name: string): string => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Sizes a canvas for the device pixel ratio and returns a cleared 2D context in CSS pixels. */
export function prepCanvas(c: HTMLCanvasElement, fallbackH = 120): { g: CanvasRenderingContext2D; w: number; h: number } {
  const dpr = window.devicePixelRatio || 1;
  const w = c.clientWidth || 300, h = c.clientHeight || fallbackH;
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  const g = c.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  return { g, w, h };
}

/** Redraw callback on container resize (debounced). */
export function onResize(el: Element, fn: () => void): () => void {
  let t: ReturnType<typeof setTimeout> | undefined;
  const ro = new ResizeObserver(() => {
    clearTimeout(t);
    t = setTimeout(fn, 100);
  });
  ro.observe(el);
  return () => { clearTimeout(t); ro.disconnect(); };
}
