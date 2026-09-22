import { describe, expect, it, vi } from 'vitest'
import { persistPreparedChange, VaultSessionRecoveryError } from './persistChange'
import type { PreparedVaultChange, UnlockedVaultSession } from './unlockVault'
import type { VaultSnapshot } from './types'

const prepared = { changeId: 'change-1' } as PreparedVaultChange
const snapshot = { databaseName: 'Fixture' } as VaultSnapshot

function session() {
  return {
    finishChange: vi.fn().mockResolvedValue(snapshot),
    close: vi.fn(),
  }
}

describe('revision-safe save finalization', () => {
  it('commits the worker only after Dropbox confirms the upload', async () => {
    const active = session()
    const upload = vi.fn().mockResolvedValue({ rev: 'new-rev' })
    await expect(persistPreparedChange(prepared, active as unknown as UnlockedVaultSession, upload))
      .resolves.toEqual({ remote: { rev: 'new-rev' }, vault: snapshot })
    expect(upload).toHaveBeenCalledOnce()
    expect(active.finishChange).toHaveBeenCalledWith('change-1', true)
    expect(active.close).not.toHaveBeenCalled()
  })

  it('rolls back an upload rejected by Dropbox', async () => {
    const active = session()
    const failure = new Error('Dropbox revision conflict')
    await expect(persistPreparedChange(prepared, active as unknown as UnlockedVaultSession, () => Promise.reject(failure)))
      .rejects.toBe(failure)
    expect(active.finishChange).toHaveBeenCalledWith('change-1', false)
    expect(active.close).not.toHaveBeenCalled()
  })

  it('closes the session when Dropbox saved but local commit fails', async () => {
    const active = session()
    active.finishChange.mockRejectedValue(new Error('worker stopped'))
    await expect(persistPreparedChange(prepared, active as unknown as UnlockedVaultSession, () => Promise.resolve({ rev: 'new-rev' })))
      .rejects.toBeInstanceOf(VaultSessionRecoveryError)
    expect(active.finishChange).toHaveBeenCalledTimes(1)
    expect(active.finishChange).toHaveBeenCalledWith('change-1', true)
    expect(active.close).toHaveBeenCalledOnce()
  })

  it('closes the session when a failed upload cannot be rolled back', async () => {
    const active = session()
    active.finishChange.mockRejectedValue(new Error('worker stopped'))
    await expect(persistPreparedChange(prepared, active as unknown as UnlockedVaultSession, () => Promise.reject(new Error('network'))))
      .rejects.toBeInstanceOf(VaultSessionRecoveryError)
    expect(active.finishChange).toHaveBeenCalledWith('change-1', false)
    expect(active.close).toHaveBeenCalledOnce()
  })
})
