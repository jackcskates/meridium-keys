import type { DropboxVaultFile } from './types'

export function upsertVault(current: DropboxVaultFile[], vault: DropboxVaultFile) {
  return [...current.filter((entry) => entry.id !== vault.id), vault]
    .sort((left, right) => left.name.localeCompare(right.name))
}

export function removeVault(current: DropboxVaultFile[], vaultId: string) {
  return current.filter((entry) => entry.id !== vaultId)
}
