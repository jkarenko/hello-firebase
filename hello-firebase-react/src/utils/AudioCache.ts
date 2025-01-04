// Audio cache using IndexedDB
export const AudioCache = {
  DB_NAME: "audioCache",
  STORE_NAME: "audioBuffers",
  ETAG_STORE: "etags",
  db: null as IDBDatabase | null,

  async init() {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, 2);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME);
        }
        if (!db.objectStoreNames.contains(this.ETAG_STORE)) {
          db.createObjectStore(this.ETAG_STORE);
        }
      };
    });
  },

  async get(key: string): Promise<ArrayBuffer | undefined> {
    if (!this.db) {
      return undefined;
    }
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], "readonly");
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  },

  async getETag(key: string): Promise<string | undefined> {
    if (!this.db) {
      return undefined;
    }
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.ETAG_STORE], "readonly");
      const store = transaction.objectStore(this.ETAG_STORE);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  },

  async set(key: string, value: ArrayBuffer, etag: string): Promise<void> {
    if (!this.db) {
      return;
    }
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME, this.ETAG_STORE], "readwrite");

      const store = transaction.objectStore(this.STORE_NAME);
      const etagStore = transaction.objectStore(this.ETAG_STORE);

      store.put(value, key);
      etagStore.put(etag, key);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  },
};
