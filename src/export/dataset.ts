import { Zip, ZipPassThrough, strToU8 } from 'fflate';
import type { Take } from '../analysis/qc';
import { encodeWav, type BitDepth } from '../analysis/wav';
import { pad3 } from '../lib/music';

/** voice_sample_001.wav, voice_sample_p2_014.wav … — sortable and free of spaces/accents for Applio. */
export const takeFileName = (t: Pick<Take, 'pass' | 'n'>): string =>
  'voice_sample_' + (t.pass > 1 ? 'p' + t.pass + '_' : '') + pad3(t.n) + '.wav';

export const sortTakes = (takes: Iterable<Take>): Take[] => [...takes].sort((a, b) => a.pass - b.pass || a.n - b.n);

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

/**
 * Builds a ZIP with no compression (WAV barely compresses and STORE is instant).
 * Streams entry by entry so memory stays close to the size of the output.
 */
export function buildZip(entries: ZipEntry[]): Promise<Uint8Array[]> {
  return new Promise((resolve, reject) => {
    const parts: Uint8Array[] = [];
    const zip = new Zip((err, chunk, final) => {
      if (err) return reject(err);
      parts.push(chunk);
      if (final) resolve(parts);
    });
    for (const e of entries) {
      const f = new ZipPassThrough(e.name);
      zip.add(f);
      f.push(e.data, true);
    }
    zip.end();
  });
}

export function datasetEntries(
  takes: Take[],
  bits: BitDepth,
  readme: string,
  folder = 'rvc_dataset',
  datasetInfo?: string,
): ZipEntry[] {
  const out: ZipEntry[] = takes
    .filter(t => t.pcm && t.sr)
    .map(t => ({ name: `${folder}/${takeFileName(t)}`, data: encodeWav([t.pcm!], t.sr!, bits) }));
  out.push({ name: `${folder}/README.txt`, data: strToU8(readme.replace(/\n/g, '\r\n')) });
  if (datasetInfo) {
    out.push({ name: `${folder}/dataset_info.json`, data: strToU8(datasetInfo) });
  }
  return out;
}

/** All takes at the first take's sample rate, joined with 0.4 s of silence. */
export function sessionWav(takes: Take[], bits: BitDepth): { data: Uint8Array; skipped: number } | null {
  const real = takes.filter(t => t.pcm && t.sr);
  if (!real.length) return null;
  const sr = real[0].sr!;
  const same = real.filter(t => t.sr === sr);
  return { data: encodeWav(same.map(t => t.pcm!), sr, bits, 0.4), skipped: real.length - same.length };
}

export function download(parts: BlobPart[], name: string, type: string): void {
  const u = URL.createObjectURL(new Blob(parts, { type }));
  const a = document.createElement('a');
  a.href = u;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 10000);
}
