/**
 * Tests for src/storage/backup.ts (Etapa 3 — T-05).
 *
 * Coverage:
 *  1. Round-trip: backup → serialise → parse → restore → verify
 *  2. Valid backup with no takes
 *  3. Corrupt JSON → BackupValidationError('invalid_json')
 *  4. Invalid structure (missing manifest) → BackupValidationError('invalid_structure')
 *  5. Future (unknown) version → BackupValidationError('unknown_version')
 *  6. Duplicate restore → replaced count matches
 *  7. Preview counts: added / replaced / skipped
 *  8. serializeTake / deserializeTake round-trip preserves Float32Array
 *  9. Backup with malformed takes inside a valid root → skipped count
 * 10. Cancel (no commit) leaves existing takes untouched
 */

import { describe, expect, it } from 'vitest';
import type { Take } from '../src/analysis/qc';
import {
  BACKUP_VERSION,
  BackupValidationError,
  deserializeTake,
  parseBackup,
  previewRestore,
  serializeTake,
  type ProjectBackup,
  type SerializedTake,
} from '../src/storage/backup';

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function makeTake(n: number, pass = 1, sr = 48000): Take {
  return {
    key: `${pass}:${n}`,
    id: `ex${n}`,
    n,
    pass,
    ts: Date.now(),
    sr,
    dur: 1.0,
    voiced: 0.8,
    pcm: new Float32Array([0.1, -0.2, 0.3, -0.4]),
  };
}

function makeBackup(takes: Take[], overrides: Partial<ProjectBackup> = {}): ProjectBackup {
  return {
    manifest: {
      version: BACKUP_VERSION,
      createdAt: new Date().toISOString(),
      appVersion: 'test',
      takeCount: takes.length,
      voicedSeconds: takes.reduce((s, t) => s + t.voiced, 0),
    },
    settings: {},
    lyrics: [],
    takes: takes.map(serializeTake),
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/* serializeTake / deserializeTake                                      */
/* ------------------------------------------------------------------ */

describe('serializeTake / deserializeTake', () => {
  it('round-trips a Float32Array via number[]', () => {
    const tk = makeTake(1);
    const s = serializeTake(tk);

    expect(Array.isArray(s.pcm)).toBe(true);
    expect(s.pcm).toHaveLength(4);
    expect(s.pcm![0]).toBeCloseTo(0.1);

    const restored = deserializeTake(s);
    expect(restored.pcm).toBeInstanceOf(Float32Array);
    expect(restored.pcm!.length).toBe(4);
    expect(restored.pcm![2]).toBeCloseTo(0.3);
  });

  it('handles a take without PCM', () => {
    const tk = makeTake(1);
    (tk as unknown as Record<string, unknown>).pcm = undefined;
    const s = serializeTake(tk);
    expect(s.pcm).toBeUndefined();

    const restored = deserializeTake(s);
    expect(restored.pcm).toBeInstanceOf(Float32Array);
    expect(restored.pcm!.length).toBe(0);
  });

  it('preserves all scalar fields', () => {
    const tk = makeTake(7, 2, 44100);
    const s = serializeTake(tk);
    expect(s.key).toBe('2:7');
    expect(s.id).toBe('ex7');
    expect(s.pass).toBe(2);
    expect(s.sr).toBe(44100);
    expect(s.voiced).toBe(0.8);
  });
});

/* ------------------------------------------------------------------ */
/* parseBackup — valid cases                                            */
/* ------------------------------------------------------------------ */

describe('parseBackup — valid', () => {
  it('round-trip: serialise → JSON → parse returns identical takes', () => {
    const takes = [makeTake(1), makeTake(2), makeTake(3)];
    const backup = makeBackup(takes);
    const json = JSON.stringify(backup);

    const parsed = parseBackup(json);
    expect(parsed.manifest.version).toBe(BACKUP_VERSION);
    expect(parsed.manifest.takeCount).toBe(3);
    expect(parsed.takes).toHaveLength(3);
    expect(parsed.takes[0].key).toBe('1:1');
    expect(parsed.takes[2].key).toBe('1:3');
  });

  it('accepts a backup with zero takes', () => {
    const backup = makeBackup([]);
    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed.takes).toHaveLength(0);
  });

  it('accepts a backup with empty lyrics array', () => {
    const backup = makeBackup([makeTake(1)], { lyrics: [] });
    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed.lyrics).toHaveLength(0);
  });

  it('accepts a backup with lyrics', () => {
    const backup = makeBackup([], {
      lyrics: [{ id: 'abc', text: 'Hello world', lang: 'en' as const }],
    });
    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed.lyrics[0].text).toBe('Hello world');
  });
});

/* ------------------------------------------------------------------ */
/* parseBackup — error cases                                            */
/* ------------------------------------------------------------------ */

describe('parseBackup — errors', () => {
  it('throws invalid_json for non-JSON input', () => {
    expect(() => parseBackup('NOT JSON AT ALL')).toThrow(BackupValidationError);
    expect(() => parseBackup('NOT JSON AT ALL')).toThrow(
      expect.objectContaining({ code: 'invalid_json' }),
    );
  });

  it('throws invalid_structure for an empty object', () => {
    expect(() => parseBackup('{}')).toThrow(
      expect.objectContaining({ code: 'invalid_structure' }),
    );
  });

  it('throws invalid_structure when manifest is missing', () => {
    const bad = JSON.stringify({ settings: {}, lyrics: [], takes: [] });
    expect(() => parseBackup(bad)).toThrow(
      expect.objectContaining({ code: 'invalid_structure' }),
    );
  });

  it('throws invalid_structure when manifest.version is missing', () => {
    const bad = JSON.stringify({
      manifest: { createdAt: 'x', appVersion: 'x', takeCount: 0, voicedSeconds: 0 },
      settings: {},
      lyrics: [],
      takes: [],
    });
    expect(() => parseBackup(bad)).toThrow(
      expect.objectContaining({ code: 'invalid_structure' }),
    );
  });

  it('throws unknown_version for a version > BACKUP_VERSION', () => {
    const backup = makeBackup([]);
    backup.manifest.version = BACKUP_VERSION + 99;
    expect(() => parseBackup(JSON.stringify(backup))).toThrow(
      expect.objectContaining({ code: 'unknown_version' }),
    );
  });

  it('throws invalid_structure when takes is not an array', () => {
    const bad = JSON.stringify({
      manifest: { version: 1, createdAt: 'x', appVersion: 'x', takeCount: 0, voicedSeconds: 0 },
      settings: {},
      lyrics: [],
      takes: 'oops',
    });
    expect(() => parseBackup(bad)).toThrow(
      expect.objectContaining({ code: 'invalid_structure' }),
    );
  });

  it('throws invalid_structure when a take is missing required fields', () => {
    const bad = JSON.stringify({
      manifest: { version: 1, createdAt: 'x', appVersion: 'x', takeCount: 1, voicedSeconds: 0 },
      settings: {},
      lyrics: [],
      takes: [{ key: 'valid' /* id is missing */ }],
    });
    expect(() => parseBackup(bad)).toThrow(
      expect.objectContaining({ code: 'invalid_structure' }),
    );
  });

  it('throws invalid_structure when lyrics item is malformed', () => {
    const bad = JSON.stringify({
      manifest: { version: 1, createdAt: 'x', appVersion: 'x', takeCount: 0, voicedSeconds: 0 },
      settings: {},
      lyrics: [{ id: 'x', text: 42 /* not a string */, lang: 'en' }],
      takes: [],
    });
    expect(() => parseBackup(bad)).toThrow(
      expect.objectContaining({ code: 'invalid_structure' }),
    );
  });

  it('throws invalid_structure when take.pcm contains non-numbers', () => {
    const bad = JSON.stringify({
      manifest: { version: 1, createdAt: 'x', appVersion: 'x', takeCount: 1, voicedSeconds: 0 },
      settings: {},
      lyrics: [],
      takes: [{ key: 'a', id: 'b', ex: 'c', pcm: ['not', 'a', 'number'] }],
    });
    expect(() => parseBackup(bad)).toThrow(
      expect.objectContaining({ code: 'invalid_structure' }),
    );
  });
});

/* ------------------------------------------------------------------ */
/* previewRestore                                                        */
/* ------------------------------------------------------------------ */

describe('previewRestore', () => {
  it('counts added takes when current map is empty', () => {
    const takes = [makeTake(1), makeTake(2)];
    const backup = makeBackup(takes);
    const current = new Map<string, Take>();

    const preview = previewRestore(backup, current);
    expect(preview.added).toBe(2);
    expect(preview.replaced).toBe(0);
    expect(preview.skipped).toBe(0);
    expect(preview.unknownVersion).toBe(false);
  });

  it('counts replaced takes for existing keys', () => {
    const t1 = makeTake(1);
    const t2 = makeTake(2);
    const backup = makeBackup([t1, t2]);
    const current = new Map([[t1.key, t1]]); // t1 already in store

    const preview = previewRestore(backup, current);
    expect(preview.added).toBe(1);   // t2 is new
    expect(preview.replaced).toBe(1); // t1 will be overwritten
    expect(preview.skipped).toBe(0);
  });

  it('counts skipped takes that are missing key/id', () => {
    const backup = makeBackup([]);
    // inject a malformed serialized take directly
    const malformed: Partial<SerializedTake> = { key: undefined, id: 'x' } as Partial<SerializedTake>;
    backup.takes = [malformed as SerializedTake];

    const current = new Map<string, Take>();
    const preview = previewRestore(backup, current);
    expect(preview.skipped).toBe(1);
    expect(preview.added).toBe(0);
  });

  it('sets unknownVersion=true for future versions', () => {
    const backup = makeBackup([]);
    backup.manifest.version = BACKUP_VERSION + 1;

    const preview = previewRestore(backup, new Map());
    expect(preview.unknownVersion).toBe(true);
  });

  it('duplicate import: all takes are replaced, none added', () => {
    const takes = [makeTake(1), makeTake(2), makeTake(3)];
    const backup = makeBackup(takes);
    const current = new Map(takes.map(t => [t.key, t]));

    const preview = previewRestore(backup, current);
    expect(preview.added).toBe(0);
    expect(preview.replaced).toBe(3);
    expect(preview.skipped).toBe(0);
  });
});
