import { unzipSync, strFromU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { decodeWav } from '../src/analysis/wav';
import type { Take } from '../src/analysis/qc';
import { buildZip, datasetEntries, sessionWav, sortTakes, streamDatasetZip, takeFileName, type ExportProgress } from '../src/export/dataset';
import { sine } from './signals';

const mk = (n: number, pass = 1, sr = 48000): Take => ({ key: pass + ':' + n, id: 'e' + n, n, pass, ts: 0, pcm: sine(220, 0.2, 0.3, sr), sr, dur: 0.2, voiced: 0.2 });

describe('dataset export', () => {
  it('names files so they sort by pass and number', () => {
    expect(takeFileName({ n: 7, pass: 1 })).toBe('voice_sample_007.wav');
    expect(takeFileName({ n: 12, pass: 2 })).toBe('voice_sample_p2_012.wav');
    expect(sortTakes([mk(3, 2), mk(10), mk(2)]).map(t => t.key)).toEqual(['1:2', '1:10', '2:3']);
  });

  it('builds a ZIP with every take as WAV plus a README', async () => {
    const parts = await buildZip(datasetEntries([mk(1), mk(2)], 24, 'hello\nworld'));
    const buf = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
    let o = 0;
    for (const p of parts) { buf.set(p, o); o += p.length; }
    const files = unzipSync(buf);
    expect(Object.keys(files).sort()).toEqual(['rvc_dataset/README.txt', 'rvc_dataset/voice_sample_001.wav', 'rvc_dataset/voice_sample_002.wav']);
    expect(strFromU8(files['rvc_dataset/README.txt'])).toBe('hello\r\nworld');
    const w = decodeWav(files['rvc_dataset/voice_sample_001.wav']);
    expect(w.bits).toBe(24);
    expect(w.samples.length).toBe(9600);
  });

  it('joins a continuous session and skips takes at another sample rate', () => {
    const r = sessionWav([mk(1), mk(2), mk(3, 1, 44100), mk(4, 1, 32000)], 16)!;
    expect(r.sampleRate).toBe(48000);
    expect(r.skipped).toBe(2);
    expect(r.skippedFiles).toEqual(['voice_sample_003.wav', 'voice_sample_004.wav']);
    const w = decodeWav(r.data);
    expect(w.samples.length).toBe(9600 * 2 + Math.round(0.4 * 48000));
  });

  it('returns null when no valid takes are provided to sessionWav', () => {
    expect(sessionWav([], 16)).toBeNull();
  });

  it('includes dataset_info.json when metadata is provided', async () => {
    const info = JSON.stringify({ generator: 'RVC Dataset Studio' });
    const parts = await buildZip(datasetEntries([mk(1)], 16, 'readme', 'rvc_dataset', info));
    const buf = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
    let o = 0;
    for (const p of parts) { buf.set(p, o); o += p.length; }
    const files = unzipSync(buf);
    expect(files['rvc_dataset/dataset_info.json']).toBeDefined();
    expect(strFromU8(files['rvc_dataset/dataset_info.json'])).toBe(info);
  });

  it('streams dataset into ZIP progressively and emits accurate progress reports', async () => {
    const progress: ExportProgress[] = [];
    const info = JSON.stringify({ dataset: 'test' });
    const parts = await streamDatasetZip([mk(1), mk(2)], 16, 'instructions', info, {
      onProgress: p => progress.push({ ...p }),
    });
    const buf = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
    let o = 0;
    for (const p of parts) { buf.set(p, o); o += p.length; }
    const files = unzipSync(buf);
    expect(Object.keys(files).sort()).toEqual([
      'rvc_dataset/README.txt',
      'rvc_dataset/dataset_info.json',
      'rvc_dataset/voice_sample_001.wav',
      'rvc_dataset/voice_sample_002.wav',
    ]);
    expect(progress.length).toBe(4);
    expect(progress[0].currentFile).toBe('README.txt');
    expect(progress[1].currentFile).toBe('dataset_info.json');
    expect(progress[2].currentFile).toBe('voice_sample_001.wav');
    expect(progress[3].currentFile).toBe('voice_sample_002.wav');
    expect(progress[3].percent).toBe(100);
  });

  it('aborts progressive ZIP export when signal is cancelled', async () => {
    const ac = new AbortController();
    const promise = streamDatasetZip([mk(1), mk(2), mk(3)], 16, 'readme', undefined, {
      signal: ac.signal,
      onProgress: p => {
        if (p.current === 1) ac.abort();
      },
    });
    await expect(promise).rejects.toThrow();
  });

  it('benchmarks baseline datasets (curto, médio, grande) without memory corruption', async () => {
    // Curto (5 takes)
    const curto = Array.from({ length: 5 }, (_, i) => mk(i + 1));
    const p1 = await streamDatasetZip(curto, 16, 'curto');
    expect(p1.length).toBeGreaterThan(0);

    // Médio (30 takes)
    const medio = Array.from({ length: 30 }, (_, i) => mk(i + 1));
    const p2 = await streamDatasetZip(medio, 16, 'medio');
    expect(p2.length).toBeGreaterThan(0);

    // Grande (80 takes)
    const grande = Array.from({ length: 80 }, (_, i) => mk(i + 1));
    const p3 = await streamDatasetZip(grande, 16, 'grande');
    expect(p3.length).toBeGreaterThan(0);
  });
});
