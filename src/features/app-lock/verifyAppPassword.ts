const encoder = new TextEncoder()
const iterations = 600_000
const appLockStorageKey = 'meridium-keys-app-lock-v1'

type AppLockStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export type AppLockRecord = {
  version: 1
  iterations: number
  salt: string
  verifier: string
}

function encodeBase64(value: Uint8Array) {
  let binary = ''
  for (const byte of value) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function decodeBase64(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
}

export async function derivePasswordVerifier(password: string, salt: Uint8Array, rounds = iterations) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as Uint8Array<ArrayBuffer>, iterations: rounds },
    key,
    256,
  )
  return new Uint8Array(bits)
}

export function normalizeAppPasswordInput(password: string) {
  return password.trim()
}

function equalBytes(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index]
  }
  return difference === 0
}

export function readAppLockRecord(storage: AppLockStorage = localStorage): AppLockRecord | null {
  try {
    const record = JSON.parse(storage.getItem(appLockStorageKey) || 'null') as Partial<AppLockRecord> | null
    if (
      record?.version !== 1
      || typeof record.iterations !== 'number'
      || record.iterations < 100_000
      || typeof record.salt !== 'string'
      || typeof record.verifier !== 'string'
    ) return null
    decodeBase64(record.salt)
    decodeBase64(record.verifier)
    return record as AppLockRecord
  } catch {
    return null
  }
}

export function appPasswordIsConfigured(storage: AppLockStorage = localStorage) {
  return readAppLockRecord(storage) !== null
}

export async function configureAppPassword(password: string, storage: AppLockStorage = localStorage) {
  const normalized = normalizeAppPasswordInput(password)
  if (Array.from(normalized).length < 12) throw new Error('Use at least 12 characters for the app password.')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const verifier = await derivePasswordVerifier(normalized, salt)
  const record: AppLockRecord = {
    version: 1,
    iterations,
    salt: encodeBase64(salt),
    verifier: encodeBase64(verifier),
  }
  storage.setItem(appLockStorageKey, JSON.stringify(record))
  return record
}

export async function verifyAppPassword(password: string, storage: AppLockStorage = localStorage) {
  const record = readAppLockRecord(storage)
  if (!record) return false
  const actual = await derivePasswordVerifier(normalizeAppPasswordInput(password), decodeBase64(record.salt), record.iterations)
  return equalBytes(actual, decodeBase64(record.verifier))
}

export function clearAppPassword(storage: AppLockStorage = localStorage) {
  storage.removeItem(appLockStorageKey)
}
