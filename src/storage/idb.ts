import type { Take } from '../analysis/qc';

/**
 * Takes live only in this browser's IndexedDB. Nothing is ever uploaded.
 * All calls degrade to no-ops when IndexedDB is unavailable (private mode, blocked storage).
 */

const DB_NAME = 'rvc-dataset-studio';
const STORE = 'takes';
let db: IDBDatabase | null = null;

export function openDB(): Promise<boolean> {
  return new Promise(res => {
    try {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'key' });
      r.onsuccess = () => {
        db = r.result;
        res(true);
      };
      r.onerror = () => res(false);
      r.onblocked = () => res(false);
    } catch {
      res(false);
    }
  });
}

export const dbAvailable = (): boolean => !!db;

/** Asks the browser not to evict the takes under storage pressure (best effort). */
export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

function tx(mode: IDBTransactionMode): IDBObjectStore {
  return db!.transaction(STORE, mode).objectStore(STORE);
}

export function putTake(t: Take): Promise<boolean> {
  return new Promise(res => {
    if (!db) return res(false);
    try {
      const r = tx('readwrite').put(t);
      r.onsuccess = () => res(true);
      r.onerror = () => res(false);
    } catch {
      res(false);
    }
  });
}

export function deleteTake(key: string): void {
  if (!db) return;
  try { tx('readwrite').delete(key); } catch {}
}

export function clearTakes(): void {
  if (!db) return;
  try { tx('readwrite').clear(); } catch {}
}

export function allTakes(): Promise<Take[]> {
  return new Promise(res => {
    if (!db) return res([]);
    try {
      const r = tx('readonly').getAll();
      r.onsuccess = () => res((r.result as Take[]) || []);
      r.onerror = () => res([]);
    } catch {
      res([]);
    }
  });
}
