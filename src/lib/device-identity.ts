import FingerprintJS from "@fingerprintjs/fingerprintjs";

const DEVICE_ID_KEY = "quorum_device_id";
const IDB_DB_NAME = "quorum_device";
const IDB_STORE_NAME = "identity";
const IDB_RECORD_KEY = "device_id";

// ---------------------------------------------------------------------------
// IndexedDB helpers (best-effort — never throw)
// ---------------------------------------------------------------------------

function openIDB(): Promise<IDBDatabase | null> {
    return new Promise((resolve) => {
        try {
            const request = indexedDB.open(IDB_DB_NAME, 1);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
                    db.createObjectStore(IDB_STORE_NAME);
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
        } catch {
            resolve(null);
        }
    });
}

function readIDB(db: IDBDatabase): Promise<string | null> {
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(IDB_STORE_NAME, "readonly");
            const store = tx.objectStore(IDB_STORE_NAME);
            const request = store.get(IDB_RECORD_KEY);
            request.onsuccess = () =>
                resolve(typeof request.result === "string" ? request.result : null);
            request.onerror = () => resolve(null);
        } catch {
            resolve(null);
        }
    });
}

function writeIDB(db: IDBDatabase, value: string): Promise<void> {
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(IDB_STORE_NAME, "readwrite");
            const store = tx.objectStore(IDB_STORE_NAME);
            store.put(value, IDB_RECORD_KEY);
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        } catch {
            resolve();
        }
    });
}

// ---------------------------------------------------------------------------
// Persistent device ID (UUID stored in localStorage + IndexedDB)
// ---------------------------------------------------------------------------

function randomDeviceId(): string {
    try {
        if (typeof crypto?.randomUUID === "function") {
            return crypto.randomUUID();
        }
    } catch {
        // Fall through to the manual construction below.
    }

    try {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        return Array.from(bytes, (byte) =>
            byte.toString(16).padStart(2, "0"),
        ).join("");
    } catch {
        // Last resort. Not unguessable, but this only has to be distinct
        // between two students sitting in the same room.
        return `fallback-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    }
}

async function getOrCreateDeviceId(): Promise<string> {
    // 1. Check localStorage first (fastest)
    let id: string | null = null;
    try {
        id = localStorage.getItem(DEVICE_ID_KEY);
    } catch {
        // localStorage might be unavailable (private browsing, etc.)
    }

    // 2. Fall back to IndexedDB
    const db = await openIDB();
    if (!id && db) {
        id = await readIDB(db);
        // Sync back to localStorage
        if (id) {
            try {
                localStorage.setItem(DEVICE_ID_KEY, id);
            } catch {
                /* noop */
            }
        }
    }

    // 3. Generate new ID if neither had one.
    //
    // The server now rejects a check-in with no device id, so this must not be
    // allowed to throw. crypto.randomUUID is unavailable in an insecure context
    // and on older browsers, hence the fallback — a weaker id is still a
    // device-scoped one, and infinitely better than blocking a real student at
    // the classroom door.
    if (!id) {
        id = randomDeviceId();
    }

    // 4. Persist to both stores
    try {
        localStorage.setItem(DEVICE_ID_KEY, id);
    } catch {
        /* noop */
    }
    if (db) {
        await writeIDB(db, id);
    }

    return id;
}

// ---------------------------------------------------------------------------
// FingerprintJS visitorId
// ---------------------------------------------------------------------------

async function getFingerprintVisitorId(): Promise<string> {
    try {
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        return result.visitorId;
    } catch {
        // Fallback: deterministic hash from basic browser signals
        const components = [
            navigator.userAgent,
            navigator.language,
            screen.width + "x" + screen.height,
            screen.colorDepth,
            Intl.DateTimeFormat().resolvedOptions().timeZone,
            navigator.hardwareConcurrency || "",
            (navigator as unknown as { deviceMemory?: number }).deviceMemory || "",
        ].join("|");
        let hash = 0;
        for (let i = 0; i < components.length; i++) {
            hash = (hash << 5) - hash + components.charCodeAt(i);
            hash |= 0;
        }
        return "fallback_" + Math.abs(hash).toString(36);
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface DeviceIdentity {
    /** Persistent random UUID — unique per browser profile, survives across sessions */
    deviceId: string;
    /** FingerprintJS visitorId — hardware-derived, survives clearing storage */
    fingerprint: string;
}

/**
 * Returns both the persistent device UUID and the FingerprintJS visitorId.
 * Both values are best-effort and non-blocking — failures fall back gracefully.
 */
export async function getDeviceIdentity(): Promise<DeviceIdentity> {
    const [deviceId, fingerprint] = await Promise.all([
        getOrCreateDeviceId(),
        getFingerprintVisitorId(),
    ]);

    return { deviceId, fingerprint };
}
