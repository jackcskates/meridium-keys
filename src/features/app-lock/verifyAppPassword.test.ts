import { describe, expect, it } from 'vitest'
import { derivePasswordVerifier } from './verifyAppPassword'

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
})
