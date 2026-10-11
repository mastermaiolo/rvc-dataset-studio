import { Zip, ZipPassThrough, strToU8 } from 'fflate';
import type { Take } from '../analysis/qc';
import { encodeWav, type BitDepth } from '../analysis/wav';
import { resamplePCM } from '../analysis/resample';
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

export interface ExportProgress {
  current: number;
  total: number;
  currentFile: string;
  percent: number;
}

export interface StreamZipOptions {
  folder?: string;
  signal?: AbortSignal;
  onProgress?: (progress: ExportProgress) => void;
  onChunk?: (chunk: Uint8Array) => void | Promise<void>;
  /** Target sample rate for all WAVs. undefined = preserve each take's original rate. */
  targetSR?: number;
}

/**
 * Builds a ZIP archive streaming one file at a time without accumulating all encoded
 * WAVs in memory simultaneously. Reduces memory footprint and provides granular progress and cancellation.
 */
export function streamDatasetZip(
  takes: Take[],
  bits: BitDepth,
  readme: string,
  datasetInfo?: string,
  options?: StreamZipOptions,
): Promise<Uint8Array[]> {
  return new Promise((resolve, reject) => {
    const folder = options?.folder ?? 'rvc_dataset';
    const parts: Uint8Array[] = [];
    let completed = false;

    const zip = new Zip((err, chunk, final) => {
      if (err) {
        if (!completed) {
          completed = true;
          reject(err);
        }
        return;
      }
      if (options?.onChunk) {
        try {
          void options.onChunk(chunk);
        } catch (e) {
          if (!completed) {
            completed = true;
            zip.terminate();
            reject(e);
          }
          return;
        }
      } else {
        parts.push(chunk);
      }
      if (final && !completed) {
        completed = true;
        resolve(parts);
      }
    });

    const onAbort = () => {
      if (!completed) {
        completed = true;
        zip.terminate();
        reject(new DOMException('Export cancelled', 'AbortError'));
      }
    };

    if (options?.signal) {
      if (options.signal.aborted) {
        onAbort();
        return;
      }
      options.signal.addEventListener('abort', onAbort, { once: true });
    }

    void (async () => {
      try {
        const real = takes.filter(t => t.pcm && t.sr);
        const totalFiles = real.length + 1 + (datasetInfo ? 1 : 0);
        let step = 0;

        // 1. README.txt
        if (options?.signal?.aborted) { onAbort(); return; }
        const fReadme = new ZipPassThrough(`${folder}/README.txt`);
        zip.add(fReadme);
        fReadme.push(strToU8(readme.replace(/\n/g, '\r\n')), true);
        step++;
        options?.onProgress?.({
          current: step,
          total: totalFiles,
          currentFile: 'README.txt',
          percent: Math.round((step / totalFiles) * 100),
        });
        await new Promise(r => setTimeout(r, 0));

        // 2. dataset_info.json (if provided)
        if (datasetInfo) {
          if (options?.signal?.aborted) { onAbort(); return; }
          const fInfo = new ZipPassThrough(`${folder}/dataset_info.json`);
          zip.add(fInfo);
          fInfo.push(strToU8(datasetInfo), true);
          step++;
          options?.onProgress?.({
            current: step,
            total: totalFiles,
            currentFile: 'dataset_info.json',
            percent: Math.round((step / totalFiles) * 100),
          });
          await new Promise(r => setTimeout(r, 0));
        }

        // 3. Takes encoded one by one
        for (let i = 0; i < real.length; i++) {
          if (options?.signal?.aborted) { onAbort(); return; }
          const t = real[i];
          const fileName = takeFileName(t);
          const pcm = options?.targetSR && t.sr && t.sr !== options.targetSR
            ? resamplePCM(t.pcm!, t.sr, options.targetSR)
            : t.pcm!;
          const sr = options?.targetSR ?? t.sr!;
          const wav = encodeWav([pcm], sr, bits);
          const fTake = new ZipPassThrough(`${folder}/${fileName}`);
          zip.add(fTake);
          fTake.push(wav, true);
          step++;
          options?.onProgress?.({
            current: step,
            total: totalFiles,
            currentFile: fileName,
            percent: Math.round((step / totalFiles) * 100),
          });
          // Yield to event loop
          await new Promise(r => setTimeout(r, 0));
        }

        if (options?.signal?.aborted) { onAbort(); return; }
        zip.end();
      } catch (err) {
        if (!completed) {
          completed = true;
          zip.terminate();
          reject(err);
        }
      }
    })();
  });
}

export interface SessionWavResult {
  data: Uint8Array;
  sampleRate: number;
  skipped: number;
  skippedFiles: string[];
}

/** All takes at the first take's sample rate, joined with 0.4 s of silence. */
export function sessionWav(takes: Take[], bits: BitDepth): SessionWavResult | null {
  const real = takes.filter(t => t.pcm && t.sr);
  if (!real.length) return null;
  const sr = real[0].sr!;
  const same = real.filter(t => t.sr === sr);
  const diff = real.filter(t => t.sr !== sr);
  return {
    data: encodeWav(same.map(t => t.pcm!), sr, bits, 0.4),
    sampleRate: sr,
    skipped: diff.length,
    skippedFiles: diff.map(takeFileName),
  };
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
