import { describe, expect, it } from 'vitest'
import { vaultPasswordReady, vaultPasswordRequirements } from './passwordPolicy'

describe('vaultPasswordRequirements', () => {
  it('accepts a long passphrase without arbitrary composition rules', () => {
    const password = 'quiet forests under moonlight'

    expect(vaultPasswordReady(password, 'Personal', password)).toBe(true)
    expect(vaultPasswordRequirements(password, 'Personal', password).every((rule) => rule.met)).toBe(true)
  })

  it('rejects short, common, repeated, vault-name, and mismatched values', () => {
    expect(vaultPasswordReady('short', 'Personal', 'short')).toBe(false)
    expect(vaultPasswordReady('password123456789', 'Personal', 'password123456789')).toBe(false)
    expect(vaultPasswordReady('a'.repeat(20), 'Personal', 'a'.repeat(20))).toBe(false)
    expect(vaultPasswordReady('personal vault phrase', 'personal vault phrase', 'personal vault phrase')).toBe(false)
    expect(vaultPasswordReady('quiet forests under moonlight', 'Personal', 'different phrase entirely')).toBe(false)
  })

  it('counts Unicode characters instead of UTF-16 code units', () => {
    const password = '🌱🌲🌳🌴🌵🌾🌿🍀sunbeam'
    expect(vaultPasswordReady(password, 'Personal', password)).toBe(true)
  })
})
