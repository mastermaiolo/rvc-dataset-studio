/**
 * Project backup / restore.
 * Format version 1: a single JSON file containing settings (localStorage),
 * lyrics (localStorage) and all takes with their raw PCM data (IndexedDB).
 *
 * PCM Float32Arrays are serialised as plain number[] so the JSON is
 * self-contained and portable — no binary blobs, no extra files.
 */

import type { Take } from '../analysis/qc';
import type { LyricLine } from '../lyrics/generate';
import type { Settings } from './settings';

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export const BACKUP_VERSION = 1;
export const BACKUP_MAX_BYTES = 512 * 1024 * 1024; // 512 MB safety ceiling

export interface BackupManifest {
  /** Bump when the format changes in a breaking way. */
  version: number;
  /** ISO-8601 timestamp of when the backup was created. */
  createdAt: string;
  /** App build version string (from package.json, injected at build time). */
  appVersion: string;
  takeCount: number;
  /** Total voiced seconds across all takes. */
  voicedSeconds: number;
}

/** Take with pcm serialised as a regular number[] (JSON-safe). */
export interface SerializedTake extends Omit<Take, 'pcm'> {
  pcm?: number[];
}

export interface ProjectBackup {
  manifest: BackupManifest;
  settings: Partial<Settings>;
  lyrics: LyricLine[];
  takes: SerializedTake[];
}

/** Summary returned after dry-running a restore. */
export interface RestorePreview {
  added: number;
  replaced: number;
  skipped: number;
  /** True when the version is higher than BACKUP_VERSION. */
  unknownVersion: boolean;
}

/* ------------------------------------------------------------------ */
/* Serialisation helpers                                                */
/* ------------------------------------------------------------------ */

export function serializeTake(tk: Take): SerializedTake {
  const { pcm, ...rest } = tk;
  const out: SerializedTake = { ...rest };
  if (pcm && pcm.length > 0) {
    out.pcm = Array.from(pcm);
  }
  return out;
}

export function deserializeTake(s: SerializedTake): Take {
  const { pcm, ...rest } = s;
  return {
    ...rest,
    pcm: pcm && pcm.length > 0 ? new Float32Array(pcm) : new Float32Array(0),
  };
}

/* ------------------------------------------------------------------ */
/* Validation                                                           */
/* ------------------------------------------------------------------ */

export class BackupValidationError extends Error {
  constructor(
    public readonly code:
      | 'invalid_json'
      | 'invalid_structure'
      | 'unknown_version'
      | 'too_large',
    message: string,
  ) {
    super(message);
    this.name = 'BackupValidationError';
  }
}

function isString(x: unknown): x is string {
  return typeof x === 'string';
}

function isNumber(x: unknown): x is number {
  return typeof x === 'number' && isFinite(x);
}

/**
 * Parses and validates a backup file.
 * Throws `BackupValidationError` if anything is wrong.
 * Returns the parsed `ProjectBackup` ready to use.
 */
export function parseBackup(raw: string): ProjectBackup {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    throw new BackupValidationError('invalid_json', 'Not valid JSON');
  }

  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new BackupValidationError('invalid_structure', 'Root is not an object');
  }

  const b = obj as Record<string, unknown>;

  // Manifest
  if (!b.manifest || typeof b.manifest !== 'object' || Array.isArray(b.manifest)) {
    throw new BackupValidationError('invalid_structure', 'Missing manifest');
  }
  const m = b.manifest as Record<string, unknown>;
  if (!isNumber(m.version)) {
    throw new BackupValidationError('invalid_structure', 'manifest.version is missing or not a number');
  }
  if (m.version > BACKUP_VERSION) {
    throw new BackupValidationError(
      'unknown_version',
      `Backup was created with a newer version of the app (v${m.version}). Update the app to restore it.`,
    );
  }
  if (!isString(m.createdAt)) {
    throw new BackupValidationError('invalid_structure', 'manifest.createdAt missing');
  }
  if (!isNumber(m.takeCount)) {
    throw new BackupValidationError('invalid_structure', 'manifest.takeCount missing');
  }

  // Settings (object, can be partial — we do not deep-validate it here; sanitize() handles that)
  if (b.settings !== undefined && (typeof b.settings !== 'object' || Array.isArray(b.settings))) {
    throw new BackupValidationError('invalid_structure', 'settings must be an object');
  }

  // Lyrics (array of {id, text, lang})
  if (!Array.isArray(b.lyrics)) {
    throw new BackupValidationError('invalid_structure', 'lyrics must be an array');
  }
  for (const l of b.lyrics as unknown[]) {
    if (!l || typeof l !== 'object' || Array.isArray(l)) {
      throw new BackupValidationError('invalid_structure', 'Each lyric must be an object');
    }
    const line = l as Record<string, unknown>;
    if (!isString(line.id) || !isString(line.text) || !isString(line.lang)) {
      throw new BackupValidationError('invalid_structure', 'Lyric missing id/text/lang strings');
    }
  }

  // Takes (array)
  if (!Array.isArray(b.takes)) {
    throw new BackupValidationError('invalid_structure', 'takes must be an array');
  }
  for (const tk of b.takes as unknown[]) {
    if (!tk || typeof tk !== 'object' || Array.isArray(tk)) {
      throw new BackupValidationError('invalid_structure', 'Each take must be an object');
    }
    const t = tk as Record<string, unknown>;
    if (!isString(t.key) || !isString(t.id)) {
      throw new BackupValidationError('invalid_structure', 'Take missing key/id strings');
    }
    if (t.pcm !== undefined) {
      if (!Array.isArray(t.pcm)) {
        throw new BackupValidationError('invalid_structure', 'Take.pcm must be an array');
      }
      // spot-check the first element
      if (t.pcm.length > 0 && typeof t.pcm[0] !== 'number') {
        throw new BackupValidationError('invalid_structure', 'Take.pcm must be a number array');
      }
    }
  }

  return {
    manifest: m as unknown as BackupManifest,
    settings: (b.settings ?? {}) as Partial<Settings>,
    lyrics: b.lyrics as LyricLine[],
    takes: b.takes as SerializedTake[],
  };
}

/* ------------------------------------------------------------------ */
/* Preview (dry-run, no writes)                                         */
/* ------------------------------------------------------------------ */

/**
 * Computes a diff summary without touching IndexedDB.
 * @param backup   Validated backup to inspect.
 * @param current  Map of takes currently in IndexedDB (key → Take).
 */
export function previewRestore(
  backup: ProjectBackup,
  current: Map<string, Take>,
): RestorePreview {
  let added = 0;
  let replaced = 0;
  let skipped = 0;

  for (const tk of backup.takes) {
    if (!isString(tk.key) || !isString(tk.id)) {
      skipped++;
      continue;
    }
    if (current.has(tk.key)) {
      replaced++;
    } else {
      added++;
    }
  }

  return {
    added,
    replaced,
    skipped,
    unknownVersion: (backup.manifest.version ?? 0) > BACKUP_VERSION,
  };
}
