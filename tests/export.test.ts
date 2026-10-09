import { unzipSync, strFromU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { decodeWav } from '../src/analysis/wav';
import type { Take } from '../src/analysis/qc';
import { buildZip, datasetEntries, sessionWav, sortTakes, takeFileName } from '../src/export/dataset';
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
    const r = sessionWav([mk(1), mk(2), mk(3, 1, 44100)], 16)!;
    expect(r.skipped).toBe(1);
    const w = decodeWav(r.data);
    expect(w.samples.length).toBe(9600 * 2 + Math.round(0.4 * 48000));
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
});
