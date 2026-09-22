import { describe, expect, it } from 'vitest'
import {
  appPasswordIsConfigured,
  clearAppPassword,
  configureAppPassword,
  derivePasswordVerifier,
  normalizeAppPasswordInput,
  verifyAppPassword,
} from './verifyAppPassword'

function createStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  }
}

describe('derivePasswordVerifier', () => {
  it('is deterministic for the same password and salt', async () => {
    const salt = new Uint8Array([1, 3, 3, 7])
    const first = await derivePasswordVerifier('fixture-only-password', salt, 10)
    const second = await derivePasswordVerifier('fixture-only-password', salt, 10)
    expect(first).toEqual(second)
  })

  it('changes when the password changes', async () => {
    const salt = new Uint8Array([1, 3, 3, 7])
    const first = await derivePasswordVerifier('fixture-password-a', salt, 10)
    const second = await derivePasswordVerifier('fixture-password-b', salt, 10)
    expect(first).not.toEqual(second)
  })

  it('ignores accidental whitespace around the temporary app password', () => {
    expect(normalizeAppPasswordInput('  fixture-only-password\n')).toBe('fixture-only-password')
  })

  it('configures, verifies, rejects, and clears a device-local app password', async () => {
    const storage = createStorage()
    expect(appPasswordIsConfigured(storage)).toBe(false)

    await configureAppPassword('fixture-only-password', storage)

    expect(appPasswordIsConfigured(storage)).toBe(true)
    await expect(verifyAppPassword('fixture-only-password', storage)).resolves.toBe(true)
    await expect(verifyAppPassword('wrong-fixture-password', storage)).resolves.toBe(false)
    await expect(verifyAppPassword('  fixture-only-password  ', storage)).resolves.toBe(true)

    clearAppPassword(storage)
    expect(appPasswordIsConfigured(storage)).toBe(false)
  })

  it('rejects an app password that is too short before storing it', async () => {
    const storage = createStorage()
    await expect(configureAppPassword('too-short', storage)).rejects.toThrow('at least 12 characters')
    expect(appPasswordIsConfigured(storage)).toBe(false)
  })
})
