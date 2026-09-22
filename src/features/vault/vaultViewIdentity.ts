export function vaultViewIdentity(storage: 'device' | 'dropbox' | null, dropboxVaultId: string, deviceSelectionId: number) {
  return storage === 'dropbox' ? `dropbox:${dropboxVaultId}` : `device:${deviceSelectionId}`
}
