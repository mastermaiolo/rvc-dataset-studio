import type { ComponentChildren } from 'preact';

/** Renders **bold** and `code` spans from translation strings without using innerHTML. */
export function Rich({ text }: { text: string }) {
  const out: ComponentChildren[] = [];
  const re = /\*\*(.+?)\*\*|`(.+?)`/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(m[1] != null ? <b key={k++}>{m[1]}</b> : <code key={k++}>{m[2]}</code>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}
