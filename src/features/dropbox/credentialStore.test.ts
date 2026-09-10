import { describe, expect, it } from 'vitest'
import { openCredential, sealCredential } from './credentialStore'

describe('Dropbox credential sealing', () => {
  it('round-trips a refresh credential without storing plaintext', async () => {
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
    const token = 'dropbox-refresh-token-fixture'
    const sealed = await sealCredential(key, token)

    expect(new TextDecoder().decode(sealed.ciphertext)).not.toContain(token)
    await expect(openCredential(key, sealed)).resolves.toBe(token)
  })

  it('cannot open a saved credential with another key', async () => {
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
    const wrongKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
    const sealed = await sealCredential(key, 'sensitive-refresh-token')

    await expect(openCredential(wrongKey, sealed)).rejects.toBeDefined()
  })
})
