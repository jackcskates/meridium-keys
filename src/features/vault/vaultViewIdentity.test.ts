import { describe, expect, it } from 'vitest'
import { vaultViewIdentity } from './vaultViewIdentity'

describe('vault working-surface identity', () => {
  it('keeps two unlocked Dropbox vaults in distinct UI sessions', () => {
    expect(vaultViewIdentity('dropbox', 'id:alpha', 0)).not.toBe(vaultViewIdentity('dropbox', 'id:beta', 0))
  })

  it('treats a newly selected local file as a new UI session even when its name is reused', () => {
    expect(vaultViewIdentity('device', '', 1)).not.toBe(vaultViewIdentity('device', '', 2))
  })
})
