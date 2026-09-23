import { Check, ChevronRight, FileKey2, LockKeyhole, Plus, RefreshCw, Search, Trash2 } from 'lucide-react'
import { filterVaults } from '../features/dropbox/vaultLibrary'
import type { DropboxVaultFile } from '../features/dropbox/types'
import { VaultListSkeleton } from './LoadingSkeletons'

type MobileVaultHomeProps = {
  vaults: DropboxVaultFile[]
  query: string
  onQueryChange: (query: string) => void
  isOnline: boolean
  isConnected: boolean
  isLoading: boolean
  openingVaultId: string
  deletingVaultId: string
  openVaultIds: string[]
  deviceVaultName: string | null
  deviceVaultOpen: boolean
  onRefresh: () => void
  onCreate: () => void
  onOpenVault: (vault: DropboxVaultFile) => void
  onDeleteVault: (vault: DropboxVaultFile) => void
  onOpenDeviceVault: () => void
  onPickDeviceFile: () => void
  onSignOut: () => void
}

export function MobileVaultHome({ vaults, query, onQueryChange, isOnline, isConnected, isLoading, openingVaultId, deletingVaultId, openVaultIds, deviceVaultName, deviceVaultOpen, onRefresh, onCreate, onOpenVault, onDeleteVault, onOpenDeviceVault, onPickDeviceFile, onSignOut }: MobileVaultHomeProps) {
  const visibleVaults = filterVaults(vaults, query)
  return <div className="mobile-home">
    <div className="mobile-home-heading"><div><p className="eyebrow">Your encrypted library</p><h1>Vaults</h1></div><button aria-label="Create a vault" className="mobile-home-add" onClick={onCreate} title="Create a vault" type="button"><Plus aria-hidden="true" size={23} /></button></div>
    <label className="mobile-vault-search"><Search aria-hidden="true" size={18} /><span className="visually-hidden">Find a vault in Dropbox</span><input aria-label="Find a vault in Dropbox" autoComplete="off" enterKeyHint="search" onChange={(event) => onQueryChange(event.target.value)} placeholder="Find a vault" spellCheck={false} type="search" value={query} /></label>
    <div className="mobile-home-section-heading"><span><span aria-hidden="true" className={`status-dot ${isOnline && isConnected ? 'is-ready' : ''}`} />On Dropbox <small>{vaults.length}</small></span><button aria-label="Refresh Dropbox vaults" disabled={isLoading} onClick={onRefresh} title="Refresh vaults" type="button"><RefreshCw aria-hidden="true" size={17} /></button></div>
    <div className="mobile-vault-list">
      {isLoading && !vaults.length && <VaultListSkeleton />}
      {visibleVaults.map((vault) => {
        const open = openVaultIds.includes(vault.id)
        const name = vault.name.replace(/\.kdbx$/i, '')
        return <div className="mobile-vault-item" key={vault.id}><button className="mobile-vault-open" disabled={Boolean(openingVaultId || deletingVaultId)} onClick={() => onOpenVault(vault)} type="button"><span className="vault-avatar">{vault.name.slice(0, 1).toUpperCase()}<span className="vault-lock">{open ? <Check aria-hidden="true" size={11} /> : <LockKeyhole aria-hidden="true" size={11} />}</span></span><span><strong>{name}</strong><small>{openingVaultId === vault.id ? 'Opening…' : open ? 'Open vault' : 'Locked vault'}</small></span><ChevronRight aria-hidden="true" className="icon" size={18} /></button><button aria-label={`Delete ${name} from Dropbox`} className="mobile-vault-delete" disabled={Boolean(openingVaultId || deletingVaultId)} onClick={() => onDeleteVault(vault)} title="Delete vault" type="button"><Trash2 aria-hidden="true" size={17} /></button></div>
      })}
      {!visibleVaults.length && !isLoading && <p className="mobile-home-empty">{query.trim() ? 'No vaults match that search.' : 'Create a vault to get started.'}</p>}
    </div>
    {deviceVaultName && <button className="mobile-device-vault" onClick={onOpenDeviceVault} type="button"><FileKey2 aria-hidden="true" size={19} /><span>{deviceVaultName.replace(/\.kdbx$/i, '')}<small>{deviceVaultOpen ? 'Open' : 'Locked'} · On this device · read only</small></span><ChevronRight aria-hidden="true" size={18} /></button>}
    <button className="mobile-open-device" onClick={onPickDeviceFile} type="button"><FileKey2 aria-hidden="true" size={18} />Open a KDBX file on this device</button>
    <button className="mobile-sign-out" onClick={onSignOut} type="button">Sign out</button>
  </div>
}
