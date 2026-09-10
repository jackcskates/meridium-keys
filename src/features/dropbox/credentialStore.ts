const databaseName = 'meridium-keys-auth'
const storeName = 'credentials'
const wrappingKeyId = 'dropbox-wrapping-key'
const refreshTokenId = 'dropbox-refresh-token'

export type SealedCredential = {
  iv: ArrayBuffer
  ciphertext: ArrayBuffer
}

export async function sealCredential(key: CryptoKey, value: string): Promise<SealedCredential> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(value))
  return { iv: iv.buffer.slice(0), ciphertext }
}

export async function openCredential(key: CryptoKey, sealed: SealedCredential) {
  const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(sealed.iv) }, key, sealed.ciphertext)
  return new TextDecoder().decode(clear)
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Credential storage failed.'))
  })
}

function openCredentialDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) request.result.createObjectStore(storeName)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Credential storage is unavailable.'))
  })
}

async function readValue<T>(database: IDBDatabase, key: string) {
  return requestResult(database.transaction(storeName, 'readonly').objectStore(storeName).get(key)) as Promise<T | undefined>
}

async function writeValue(database: IDBDatabase, key: string, value: unknown) {
  await requestResult(database.transaction(storeName, 'readwrite').objectStore(storeName).put(value, key))
}

async function wrappingKey(database: IDBDatabase) {
  const stored = await readValue<CryptoKey>(database, wrappingKeyId)
  if (stored) return stored
  const created = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  await writeValue(database, wrappingKeyId, created)
  return created
}

export async function rememberDropboxRefreshToken(refreshToken: string) {
  const database = await openCredentialDatabase()
  try {
    const key = await wrappingKey(database)
    await writeValue(database, refreshTokenId, await sealCredential(key, refreshToken))
  } finally {
    database.close()
  }
}

export async function loadDropboxRefreshToken() {
  const database = await openCredentialDatabase()
  try {
    const sealed = await readValue<SealedCredential>(database, refreshTokenId)
    const key = await readValue<CryptoKey>(database, wrappingKeyId)
    if (!sealed || !key) return null
    return openCredential(key, sealed)
  } catch {
    return null
  } finally {
    database.close()
  }
}

export async function forgetDropboxRefreshToken() {
  const database = await openCredentialDatabase()
  try {
    await requestResult(database.transaction(storeName, 'readwrite').objectStore(storeName).delete(refreshTokenId))
  } finally {
    database.close()
  }
}
