/** Uncompressed mono PCM WAV encoding (16- or 24-bit, little-endian). */

export type BitDepth = 16 | 24;

function writeHeader(v: DataView, n: number, sr: number, bits: BitDepth): void {
  const bps = bits / 8;
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF');
  v.setUint32(4, 36 + n * bps, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true); // fmt chunk size
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * bps, true); // byte rate
  v.setUint16(32, bps, true); // block align
  v.setUint16(34, bits, true);
  str(36, 'data');
  v.setUint32(40, n * bps, true);
}

function writeSamples(v: DataView, o: number, x: Float32Array, bits: BitDepth): number {
  if (bits === 24) {
    for (let i = 0; i < x.length; i++) {
      const s = Math.max(-1, Math.min(1, x[i]));
      const q = Math.round(s * 8388607);
      v.setUint8(o, q & 255);
      v.setUint8(o + 1, (q >> 8) & 255);
      v.setUint8(o + 2, (q >> 16) & 255);
      o += 3;
    }
  } else {
    for (let i = 0; i < x.length; i++) {
      const s = Math.max(-1, Math.min(1, x[i]));
      v.setInt16(o, s < 0 ? Math.round(s * 32768) : Math.round(s * 32767), true);
      o += 2;
    }
  }
  return o;
}

/**
 * Encodes one or more clips back to back, with `gapSec` of digital silence between them.
 * Returns the complete file bytes.
 */
export function encodeWav(pcms: Float32Array[], sr: number, bits: BitDepth, gapSec = 0): Uint8Array {
  const gap = Math.round(gapSec * sr), bps = bits / 8;
  const n = pcms.reduce((a, p) => a + p.length, 0) + gap * Math.max(0, pcms.length - 1);
  const buf = new ArrayBuffer(44 + n * bps);
  const v = new DataView(buf);
  writeHeader(v, n, Math.round(sr), bits);
  let o = 44;
  pcms.forEach((p, i) => {
    if (i) o += gap * bps;
    o = writeSamples(v, o, p, bits);
  });
  return new Uint8Array(buf);
}

export interface DecodedWav {
  sr: number;
  bits: number;
  channels: number;
  samples: Float32Array;
}

/** Minimal reader for the files this app writes (used by tests and for sanity checks). */
export function decodeWav(bytes: Uint8Array): DecodedWav {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('Not a WAV file');
  const channels = v.getUint16(22, true), sr = v.getUint32(24, true), bits = v.getUint16(34, true);
  const len = v.getUint32(40, true), bps = bits / 8, n = len / bps;
  const samples = new Float32Array(n);
  for (let i = 0, o = 44; i < n; i++, o += bps) {
    if (bits === 24) {
      let q = v.getUint8(o) | (v.getUint8(o + 1) << 8) | (v.getUint8(o + 2) << 16);
      if (q & 0x800000) q |= ~0xffffff;
      samples[i] = q / 8388607;
    } else {
      const q = v.getInt16(o, true);
      samples[i] = q < 0 ? q / 32768 : q / 32767;
    }
  }
  return { sr, bits, channels, samples };
}
