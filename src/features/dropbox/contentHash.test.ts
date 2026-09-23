import { describe, expect, it } from 'vitest'
import { dropboxContentHash } from './contentHash'

describe('Dropbox content hash', () => {
  it('matches Dropbox’s empty-file definition', async () => {
    await expect(dropboxContentHash(new Blob([]))).resolves.toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
  })

  it('hashes more than one 4 MB block without changing the file', async () => {
    const bytes = new Uint8Array(4 * 1024 * 1024 + 7)
    bytes.fill(37)
    const file = new Blob([bytes])
    await expect(dropboxContentHash(file)).resolves.toBe(
      'dc71d364f358b42a45b1979038dfacd08081fab295c6e2b973d6ed9265eca0bd',
    )
    expect(file.size).toBe(bytes.length)
    expect(new Uint8Array(await file.slice(-7).arrayBuffer())).toEqual(new Uint8Array(7).fill(37))
  })
})
