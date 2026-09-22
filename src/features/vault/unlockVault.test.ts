import { afterEach, describe, expect, it, vi } from 'vitest'
import { UnlockedVaultSession } from './unlockVault'

function workerFixture() {
  return {
    onmessage: null as ((event: MessageEvent) => void) | null,
    onerror: null as (() => void) | null,
    postMessage: vi.fn(),
    terminate: vi.fn(),
  }
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('unlocked vault worker lifetime', () => {
  it('rejects pending entry reads and terminates the worker on explicit lock', async () => {
    vi.stubGlobal('window', { setTimeout, clearTimeout })
    const worker = workerFixture()
    const session = new UnlockedVaultSession(worker as unknown as Worker)
    const read = session.getEntry('fixture-entry')
    session.close()
    await expect(read).rejects.toThrow('locked before the operation finished')
    expect(worker.terminate).toHaveBeenCalledOnce()
    await expect(session.getEntry('fixture-entry')).rejects.toThrow('vault is locked')
  })

  it('terminates a stalled worker instead of leaving a decrypted session running', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('window', { setTimeout, clearTimeout })
    const worker = workerFixture()
    const session = new UnlockedVaultSession(worker as unknown as Worker)
    const read = session.getEntry('fixture-entry')
    const assertion = expect(read).rejects.toThrow('took too long')
    await vi.advanceTimersByTimeAsync(120_000)
    await assertion
    expect(worker.terminate).toHaveBeenCalledOnce()
  })
})
