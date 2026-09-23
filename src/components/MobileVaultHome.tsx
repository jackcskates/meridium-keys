import { Check, ChevronRight, FileKey2, FolderClosed, LockKeyhole, Plus, RefreshCw, Search, Trash2 } from 'lucide-react'
import { filterVaults } from '../features/dropbox/vaultLibrary'
import type { DropboxVaultFile } from '../features/dropbox/types'
import { EntryTypeIcon } from '../features/vault/EntryTypeIcon'
import type { RecentShortcut, RecentTarget } from '../features/vault/recentAccess'
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
  selectedVaultId: string
  recentVaultName: string | null
  recentShortcuts: { entries: RecentShortcut[]; folders: RecentShortcut[] }
  deviceVaultName: string | null
  deviceVaultOpen: boolean
  onRefresh: () => void
  onCreate: () => void
  onOpenVault: (vault: DropboxVaultFile) => void
  onOpenRecent: (target: RecentTarget) => void
  onDeleteVault: (vault: DropboxVaultFile) => void
  onOpenDeviceVault: () => void
  onPickDeviceFile: () => void
  onSignOut: () => void
}

export function MobileVaultHome({ vaults, query, onQueryChange, isOnline, isConnected, isLoading, openingVaultId, deletingVaultId, openVaultIds, selectedVaultId, recentVaultName, recentShortcuts, deviceVaultName, deviceVaultOpen, onRefresh, onCreate, onOpenVault, onOpenRecent, onDeleteVault, onOpenDeviceVault, onPickDeviceFile, onSignOut }: MobileVaultHomeProps) {
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
        return <div className={`mobile-vault-item ${selectedVaultId === vault.id ? 'is-selected' : ''}`} key={vault.id}><button aria-current={selectedVaultId === vault.id ? 'true' : undefined} className="mobile-vault-open" disabled={Boolean(openingVaultId || deletingVaultId)} onClick={() => onOpenVault(vault)} type="button"><span className="vault-avatar">{vault.name.slice(0, 1).toUpperCase()}<span className="vault-lock">{open ? <Check aria-hidden="true" size={11} /> : <LockKeyhole aria-hidden="true" size={11} />}</span></span><span><strong>{name}</strong><small>{openingVaultId === vault.id ? 'Opening…' : selectedVaultId === vault.id && open ? 'Selected · open' : open ? 'Open vault' : 'Locked vault'}</small></span><ChevronRight aria-hidden="true" className="icon" size={18} /></button><button aria-label={`Delete ${name} from Dropbox`} className="mobile-vault-delete" disabled={Boolean(openingVaultId || deletingVaultId)} onClick={() => onDeleteVault(vault)} title="Delete vault" type="button"><Trash2 aria-hidden="true" size={17} /></button></div>
      })}
      {!visibleVaults.length && !isLoading && <p className="mobile-home-empty">{query.trim() ? 'No vaults match that search.' : 'Create a vault to get started.'}</p>}
    </div>
    {recentVaultName && <section aria-label={`Recent shortcuts in ${recentVaultName}`} className="mobile-recent">
      <div className="mobile-recent-heading"><p className="eyebrow">Selected vault</p><h2>Recent in {recentVaultName}</h2></div>
      {recentShortcuts.entries.length > 0 && <div className="mobile-recent-group"><h3>Keys</h3>{recentShortcuts.entries.map((shortcut) => <button aria-label={`Open key ${shortcut.title}`} className="mobile-recent-row" key={shortcut.target.id} onClick={() => onOpenRecent(shortcut.target)} type="button"><span className="mobile-recent-icon">{shortcut.type && <EntryTypeIcon size={18} type={shortcut.type} />}</span><span><strong>{shortcut.title}</strong><small>{shortcut.subtitle}</small></span><ChevronRight aria-hidden="true" size={17} /></button>)}</div>}
      {recentShortcuts.folders.length > 0 && <div className="mobile-recent-group"><h3>Folders</h3>{recentShortcuts.folders.map((shortcut) => <button aria-label={`Open folder ${shortcut.title}`} className="mobile-recent-row" key={shortcut.target.id} onClick={() => onOpenRecent(shortcut.target)} type="button"><span className="mobile-recent-icon"><FolderClosed aria-hidden="true" size={18} /></span><span><strong>{shortcut.title}</strong><small>{shortcut.subtitle}</small></span><ChevronRight aria-hidden="true" size={17} /></button>)}</div>}
      {!recentShortcuts.entries.length && !recentShortcuts.folders.length && <p className="mobile-recent-empty">Open a key or folder in this vault to keep a shortcut here.</p>}
    </section>}
    {deviceVaultName && <button className="mobile-device-vault" onClick={onOpenDeviceVault} type="button"><FileKey2 aria-hidden="true" size={19} /><span>{deviceVaultName.replace(/\.kdbx$/i, '')}<small>{deviceVaultOpen ? 'Open' : 'Locked'} · On this device · read only</small></span><ChevronRight aria-hidden="true" size={18} /></button>}
    <button className="mobile-open-device" onClick={onPickDeviceFile} type="button"><FileKey2 aria-hidden="true" size={18} />Open a KDBX file on this device</button>
    <button className="mobile-sign-out" onClick={onSignOut} type="button">Sign out</button>
  </div>
}
