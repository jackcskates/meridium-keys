import type { DropboxVaultFile } from './types'

export function upsertVault(current: DropboxVaultFile[], vault: DropboxVaultFile) {
  return [...current.filter((entry) => entry.id !== vault.id), vault]
    .sort((left, right) => left.name.localeCompare(right.name))
}

export function removeVault(current: DropboxVaultFile[], vaultId: string) {
  return current.filter((entry) => entry.id !== vaultId)
}

export function filterVaults(current: DropboxVaultFile[], query: string) {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return current
  return current.filter((vault) => vault.name.replace(/\.kdbx$/i, '').toLocaleLowerCase().includes(needle))
}
