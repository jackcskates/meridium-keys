const encoder = new TextEncoder()
const iterations = 600_000
const saltBase64 = 'ZUHN+iA+EaHeZwG68HZwnw=='
const verifierBase64 = 'Ptfl5VlycKjpvhyJQigebLCqMFtPs+Hw55nZZwj5J3w='

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

export async function verifyAppPassword(password: string) {
  const actual = await derivePasswordVerifier(normalizeAppPasswordInput(password), decodeBase64(saltBase64))
  return equalBytes(actual, decodeBase64(verifierBase64))
}
