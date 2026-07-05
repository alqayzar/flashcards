/**
 * Petit wrapper clé-valeur au-dessus d'IndexedDB.
 * On utilise IndexedDB (et non localStorage) pour ne pas être limité en taille.
 * Un unique object store « kv » stocke des paires (clé string → valeur JSON).
 */

const DB_NAME = "flashcards-db"
const STORE = "kv"
const VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

  return dbPromise
}

function tx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode)
        const store = transaction.objectStore(STORE)
        const request = fn(store)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
  )
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  return tx<T>("readonly", (store) => store.get(key))
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  await tx("readwrite", (store) => store.put(value, key))
}

export async function kvDelete(key: string): Promise<void> {
  await tx("readwrite", (store) => store.delete(key))
}

/**
 * Retourne toutes les entrées dont la clé commence par `prefix`.
 * Sert de « requête » simple sur notre stockage clé-valeur.
 */
export async function kvEntriesByPrefix<T>(
  prefix: string
): Promise<Array<{ key: string; value: T }>> {
  const range = IDBKeyRange.bound(prefix, prefix + "￿")
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const out: Array<{ key: string; value: T }> = []
    const transaction = db.transaction(STORE, "readonly")
    const store = transaction.objectStore(STORE)
    const cursorReq = store.openCursor(range)
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result
      if (cursor) {
        out.push({ key: String(cursor.key), value: cursor.value as T })
        cursor.continue()
      } else {
        resolve(out)
      }
    }
    cursorReq.onerror = () => reject(cursorReq.error)
  })
}
