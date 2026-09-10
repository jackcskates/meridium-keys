import { describe, expect, it, vi } from 'vitest'
import { copyProtectedText } from './copyProtectedText'

describe('copyProtectedText', () => {
  it('passes promise-backed clipboard data to browsers that support ClipboardItem', async () => {
    let copiedBlob: Promise<Blob> | undefined
    const write = vi.fn(async () => undefined)
    const writeText = vi.fn(async () => undefined)

    await copyProtectedText(() => Promise.resolve('promise-backed-secret'), {
      clipboard: { write, writeText },
      createBlob: (value) => new Blob([value], { type: 'text/plain' }),
      createItem: (blob) => {
        copiedBlob = blob
        return {} as ClipboardItem
      },
      preferPromiseItem: true,
    })

    expect(write).toHaveBeenCalledOnce()
    expect(writeText).not.toHaveBeenCalled()
    expect(await (await copiedBlob!).text()).toBe('promise-backed-secret')
  })

  it('falls back to writeText without making another protected-field request', async () => {
    let requestCount = 0
    const value = Promise.resolve().then(() => {
      requestCount += 1
      return 'fallback-secret'
    })
    const write = vi.fn(async () => { throw new Error('Promise-backed items unavailable') })
    const writeText = vi.fn(async () => undefined)

    await copyProtectedText(() => value, {
      clipboard: { write, writeText },
      createBlob: (text) => new Blob([text], { type: 'text/plain' }),
      createItem: () => ({} as ClipboardItem),
      preferPromiseItem: true,
    })

    expect(requestCount).toBe(1)
    expect(writeText).toHaveBeenCalledWith('fallback-secret')
  })

  it('reports when clipboard access is unavailable', async () => {
    const readValue = vi.fn(() => Promise.resolve('never-copied'))
    await expect(copyProtectedText(readValue, {
      clipboard: undefined,
      createBlob: (value) => new Blob([value], { type: 'text/plain' }),
      preferPromiseItem: false,
    })).rejects.toThrow('Clipboard access is unavailable')
    expect(readValue).not.toHaveBeenCalled()
  })

  it('uses writeText directly on Chromium clients', async () => {
    const write = vi.fn(async () => undefined)
    const writeText = vi.fn(async () => undefined)

    await copyProtectedText(() => Promise.resolve('chromium-secret'), {
      clipboard: { write, writeText },
      createBlob: (value) => new Blob([value], { type: 'text/plain' }),
      createItem: () => ({} as ClipboardItem),
      preferPromiseItem: false,
    })

    expect(write).not.toHaveBeenCalled()
    expect(writeText).toHaveBeenCalledWith('chromium-secret')
  })
})
