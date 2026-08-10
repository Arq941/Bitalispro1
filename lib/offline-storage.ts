/**
 * IndexedDB Offline Storage Service for PWA / Mobile Cobrador
 * Supports offline operations queue and cached domain data.
 */

export interface OfflineOperation {
  id: string;
  idempotencyKey: string;
  operationType: 'PAYMENT' | 'DOWN_PAYMENT' | 'VISIT' | 'NON_PAYMENT_REASON' | 'RESCHEDULE' | 'PAYMENT_PROMISE' | 'EXPENSE' | 'GPS_TRACE' | 'CLIENT' | 'SALE';
  payload: any;
  clientCapturedAt: string;
  deviceId: string;
  userId: string;
  status: 'QUEUED' | 'SYNCING' | 'SYNCED' | 'CONFLICT' | 'FAILED' | 'REJECTED';
  retryCount: number;
  lastAttemptAt?: string;
  serverReceivedAt?: string;
  conflictCode?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncMetadata {
  id: string;
  lastSyncAt?: string;
  pendingCount: number;
  syncedCount: number;
  conflictCount: number;
  updatedAt: string;
}

const DB_NAME = 'CobranzaOfflineDB';
const DB_VERSION = 1;

export class OfflineStorageService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      this.dbPromise = this.initDB();
    }
  }

  private initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = request.result;

        // Store: offline_operations
        if (!db.objectStoreNames.contains('offline_operations')) {
          const store = db.createObjectStore('offline_operations', { keyPath: 'id' });
          store.createIndex('idempotencyKey', 'idempotencyKey', { unique: true });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('userId', 'userId', { unique: false });
          store.createIndex('clientCapturedAt', 'clientCapturedAt', { unique: false });
        }

        // Store: cached_clients
        if (!db.objectStoreNames.contains('cached_clients')) {
          db.createObjectStore('cached_clients', { keyPath: 'id' });
        }

        // Store: cached_routes
        if (!db.objectStoreNames.contains('cached_routes')) {
          db.createObjectStore('cached_routes', { keyPath: 'id' });
        }

        // Store: cached_credits
        if (!db.objectStoreNames.contains('cached_credits')) {
          db.createObjectStore('cached_credits', { keyPath: 'id' });
        }

        // Store: sync_metadata
        if (!db.objectStoreNames.contains('sync_metadata')) {
          db.createObjectStore('sync_metadata', { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async getDB(): Promise<IDBDatabase | null> {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      return null;
    }
    if (!this.dbPromise) {
      this.dbPromise = this.initDB();
    }
    return this.dbPromise;
  }

  public async create(op: Omit<OfflineOperation, 'createdAt' | 'updatedAt' | 'retryCount' | 'status'> & { status?: OfflineOperation['status'] }): Promise<OfflineOperation> {
    const db = await this.getDB();
    const now = new Date().toISOString();
    const operation: OfflineOperation = {
      ...op,
      status: op.status || 'QUEUED',
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    if (!db) {
      return operation;
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction('offline_operations', 'readwrite');
      const store = tx.objectStore('offline_operations');
      const req = store.add(operation);
      req.onsuccess = () => resolve(operation);
      req.onerror = () => reject(req.error);
    });
  }

  public async get(id: string): Promise<OfflineOperation | null> {
    const db = await this.getDB();
    if (!db) return null;

    return new Promise((resolve, reject) => {
      const tx = db.transaction('offline_operations', 'readonly');
      const store = tx.objectStore('offline_operations');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  public async update(id: string, updates: Partial<OfflineOperation>): Promise<OfflineOperation | null> {
    const existing = await this.get(id);
    if (!existing) return null;

    const updated: OfflineOperation = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const db = await this.getDB();
    if (!db) return updated;

    return new Promise((resolve, reject) => {
      const tx = db.transaction('offline_operations', 'readwrite');
      const store = tx.objectStore('offline_operations');
      const req = store.put(updated);
      req.onsuccess = () => resolve(updated);
      req.onerror = () => reject(req.error);
    });
  }

  public async delete(id: string): Promise<boolean> {
    const db = await this.getDB();
    if (!db) return false;

    return new Promise((resolve, reject) => {
      const tx = db.transaction('offline_operations', 'readwrite');
      const store = tx.objectStore('offline_operations');
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  public async getPending(): Promise<OfflineOperation[]> {
    const db = await this.getDB();
    if (!db) return [];

    return new Promise((resolve, reject) => {
      const tx = db.transaction('offline_operations', 'readonly');
      const store = tx.objectStore('offline_operations');
      const req = store.getAll();
      req.onsuccess = () => {
        const all: OfflineOperation[] = req.result || [];
        const pending = all.filter((o) => o.status === 'QUEUED' || o.status === 'FAILED');
        resolve(pending.sort((a, b) => new Date(a.clientCapturedAt).getTime() - new Date(b.clientCapturedAt).getTime()));
      };
      req.onerror = () => reject(req.error);
    });
  }

  public async markSynced(id: string, serverReceivedAt?: string): Promise<OfflineOperation | null> {
    return this.update(id, {
      status: 'SYNCED',
      serverReceivedAt: serverReceivedAt || new Date().toISOString(),
    });
  }

  public async markConflict(id: string, conflictCode: string, errorMessage?: string): Promise<OfflineOperation | null> {
    return this.update(id, {
      status: 'CONFLICT',
      conflictCode,
      errorMessage,
    });
  }

  public async clearSynced(): Promise<number> {
    const db = await this.getDB();
    if (!db) return 0;

    return new Promise((resolve, reject) => {
      const tx = db.transaction('offline_operations', 'readwrite');
      const store = tx.objectStore('offline_operations');
      const req = store.getAll();
      req.onsuccess = () => {
        const all: OfflineOperation[] = req.result || [];
        const synced = all.filter((o) => o.status === 'SYNCED');
        let deleted = 0;
        synced.forEach((item) => {
          store.delete(item.id);
          deleted++;
        });
        resolve(deleted);
      };
      req.onerror = () => reject(req.error);
    });
  }

  public async saveCachedData(storeName: 'cached_clients' | 'cached_routes' | 'cached_credits', items: any[]): Promise<void> {
    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.clear();
      items.forEach((item) => store.put(item));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  public async getCachedData(storeName: 'cached_clients' | 'cached_routes' | 'cached_credits'): Promise<any[]> {
    const db = await this.getDB();
    if (!db) return [];

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }
}

export const offlineStorage = new OfflineStorageService();
