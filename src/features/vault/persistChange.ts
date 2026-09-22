import type { PreparedVaultChange, UnlockedVaultSession } from './unlockVault'

export class VaultSessionRecoveryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VaultSessionRecoveryError'
  }
}

export async function persistPreparedChange<RemoteRevision>(
  prepared: PreparedVaultChange,
  session: Pick<UnlockedVaultSession, 'finishChange' | 'close'>,
  upload: () => Promise<RemoteRevision>,
) {
  let remote: RemoteRevision
  try {
    remote = await upload()
  } catch (error) {
    try {
      await session.finishChange(prepared.changeId, false)
    } catch {
      session.close()
      throw new VaultSessionRecoveryError('The save could not be confirmed and the local vault session stopped. Refresh Dropbox and reopen the vault before editing again.')
    }
    throw error
  }

  try {
    const vault = await session.finishChange(prepared.changeId, true)
    return { remote, vault }
  } catch {
    session.close()
    throw new VaultSessionRecoveryError('Dropbox saved the encrypted change, but the local vault session stopped. Reopen the vault before editing again; do not repeat the save.')
  }
}
