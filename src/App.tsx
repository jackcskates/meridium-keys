import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { verifyAppPassword } from './features/app-lock/verifyAppPassword'
import type { DropboxVaultFile } from './features/dropbox/types'
import { useDropbox } from './features/dropbox/useDropbox'
import { usePwaLifecycle } from './features/pwa/usePwaLifecycle'
import { VaultBrowser } from './features/vault/VaultBrowser'
import { createVaultFile, toVaultFileName, type CreateVaultStage } from './features/vault/createVault'
import { VaultOpenError } from './features/vault/kdbx'
import { vaultPasswordRequirements } from './features/vault/passwordPolicy'
import type { VaultEntryDraft, VaultGroupDraft, VaultSnapshot } from './features/vault/types'
import { openVaultSession, type PreparedVaultChange, type UnlockedVaultSession, type UnlockStage } from './features/vault/unlockVault'
import './App.css'

type View = 'connect' | 'vaults' | 'create' | 'unlock' | 'browse'

type IconName =
  | 'arrow-left'
  | 'check'
  | 'chevron-left'
  | 'chevron-right'
  | 'cloud'
  | 'eye'
  | 'eye-off'
  | 'file'
  | 'folder'
  | 'key'
  | 'lock'
  | 'plus'
  | 'refresh'
  | 'shield'
  | 'trash'

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    'arrow-left': <path d="m15 18-6-6 6-6" />,
    check: <path d="m5 12 4 4L19 6" />,
    'chevron-left': <path d="m15 18-6-6 6-6" />,
    'chevron-right': <path d="m9 18 6-6-6-6" />,
    cloud: <path d="M17.5 19H7a5 5 0 1 1 1.7-9.7A6.5 6.5 0 0 1 21 12a4 4 0 0 1-3.5 7Z" />,
    eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></>,
    'eye-off': <><path d="m3 3 18 18" /><path d="M10.6 6.2A10 10 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-2.1 2.8M6.6 6.6C3.6 8.4 2 12 2 12s3.5 6 10 6a9.8 9.8 0 0 0 4.2-.9M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
    file: <><path d="M6 2h8l4 4v16H6Z" /><path d="M14 2v5h5" /></>,
    folder: <path d="M3 6h6l2 2h10v11H3Z" />,
    key: <><circle cx="8" cy="12" r="4" /><path d="M12 12h9m-3 0v3m-3-3v2" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    refresh: <><path d="M20 7v5h-5" /><path d="M4 17a8 8 0 0 0 13.7-2M4 17v-5h5M20 7A8 8 0 0 0 6.3 9" /></>,
    shield: <><path d="M12 3 20 6v5c0 5-3.2 8.4-8 10-4.8-1.6-8-5-8-10V6Z" /><path d="m9 12 2 2 4-4" /></>,
    trash: <><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="m6 7 1 14h10l1-14" /><path d="M10 11v6M14 11v6" /></>,
  }

  return (
    <svg aria-hidden="true" className="icon" fill="none" height={size} viewBox="0 0 24 24" width={size}>
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
        {paths[name]}
      </g>
    </svg>
  )
}

function DeleteVaultDialog({ vault, isDeleting, error, onCancel, onDelete }: {
  vault: DropboxVaultFile
  isDeleting: boolean
  error: string
  onCancel: () => void
  onDelete: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const vaultLabel = vault.name.replace(/\.kdbx$/i, '')

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    cancelRef.current?.focus({ preventScroll: true })
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [])

  return (
    <dialog
      aria-describedby="delete-vault-description"
      aria-labelledby="delete-vault-title"
      className="confirm-dialog"
      onCancel={(event) => {
        event.preventDefault()
        if (!isDeleting) onCancel()
      }}
      ref={dialogRef}
    >
      <div className="confirm-dialog-card">
        <span className="confirm-dialog-icon"><Icon name="trash" size={24} /></span>
        <div className="confirm-dialog-copy">
          <p className="eyebrow">Delete Dropbox vault</p>
          <h2 id="delete-vault-title">Delete {vaultLabel}?</h2>
          <p id="delete-vault-description">This deletes the encrypted KDBX file from Dropbox. You do not need its master password. Dropbox may keep it in deleted files for a limited recovery period.</p>
        </div>
        {error && <p className="unlock-error" role="alert">{error}</p>}
        <div className="confirm-dialog-actions">
          <button className="button button-secondary" disabled={isDeleting} onClick={onCancel} ref={cancelRef} type="button">Cancel</button>
          <button className="button button-danger" disabled={isDeleting} onClick={onDelete} type="button"><Icon name="trash" />{isDeleting ? 'Deleting…' : `Delete ${vaultLabel}`}</button>
        </div>
      </div>
    </dialog>
  )
}

function UpdatePrompt() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW: (_serviceWorkerUrl, currentRegistration) => {
      setRegistration(currentRegistration ?? null)
      void currentRegistration?.update().catch(() => undefined)
    },
  })

  useEffect(() => {
    if (!registration) return

    const checkForUpdate = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void registration.update().catch(() => undefined)
      }
    }

    document.addEventListener('visibilitychange', checkForUpdate)
    window.addEventListener('online', checkForUpdate)
    return () => {
      document.removeEventListener('visibilitychange', checkForUpdate)
      window.removeEventListener('online', checkForUpdate)
    }
  }, [registration])

  if (!needRefresh) return null

  return (
    <div className="update-toast" role="status">
      <div>
        <strong>Update ready</strong>
        <span>Lock open vaults before updating.</span>
      </div>
      <button className="button button-small" onClick={() => updateServiceWorker(true)} type="button">Update</button>
    </div>
  )
}

function InstallPrompt({ canPromptInstall, isIos, isStandalone, install }: {
  canPromptInstall: boolean
  isIos: boolean
  isStandalone: boolean
  install: () => Promise<'accepted' | 'dismissed' | 'unavailable'>
}) {
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem('meridium-keys-install-dismissed') === 'true')
  const [showInstructions, setShowInstructions] = useState(false)

  if (isStandalone || dismissed || (!canPromptInstall && !isIos)) return null

  function dismiss() {
    sessionStorage.setItem('meridium-keys-install-dismissed', 'true')
    setDismissed(true)
  }

  async function beginInstall() {
    if (canPromptInstall) {
      const outcome = await install()
      if (outcome !== 'unavailable') dismiss()
      return
    }
    setShowInstructions(true)
  }

  return (
    <aside className="install-toast" aria-label="Install Meridium Keys">
      <BrandMark className="install-mark" />
      <div>
        <strong>{showInstructions ? 'Install from the Share menu' : 'Install Meridium Keys'}</strong>
        <span>{showInstructions ? 'Tap Share, then Add to Home Screen.' : 'Open your vaults in a dedicated app window.'}</span>
      </div>
      {showInstructions
        ? <button className="text-button" onClick={dismiss} type="button">Done</button>
        : <button className="button button-small" onClick={() => void beginInstall()} type="button">Install</button>}
      <button className="toast-dismiss" aria-label="Dismiss install message" onClick={dismiss} type="button">×</button>
    </aside>
  )
}

function BrandMark({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={`brand-mark ${className}`} viewBox="0 0 422 422">
      <g transform="translate(-9714.946 -4644.322)">
        <g transform="translate(7450.001 7503.932)">
          <g transform="matrix(.957306 0 0 .957306 -6812.128 -7294.358)">
            <path d="M9519.955 4729.087c39.663-58.265 106.523-96.56 182.257-96.56 14.076 0 27.846 1.323 41.191 3.851l-143.938 203.084-79.51-110.375Zm291.239-67.723c66.483 37.947 111.34 109.52 111.34 191.486s-44.857 153.538-111.34 191.486V4661.364Zm-69.498 408.274a222.52 222.52 0 0 1-39.484 3.534c-121.6 0-220.323-98.723-220.323-220.322 0-18.073 2.181-35.64 6.293-52.453l106.534 148.567h7.098l139.882-191.248v311.922Z" />
          </g>
        </g>
      </g>
    </svg>
  )
}

function AppLock({ onUnlock }: { onUnlock: () => void }) {
  const [showPassword, setShowPassword] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [error, setError] = useState('')

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const password = String(new FormData(form).get('appPassword') ?? '')
    setIsChecking(true)
    setError('')
    try {
      if (await verifyAppPassword(password)) {
        form.reset()
        onUnlock()
      } else {
        setError('That app password is not correct. This is separate from each vault master password.')
        const passwordInput = form.elements.namedItem('appPassword')
        if (passwordInput instanceof HTMLInputElement) {
          passwordInput.focus()
          passwordInput.select()
        }
      }
    } catch {
      setError('This device could not verify the app password. Close and reopen the updated app, then try again.')
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <div className="app-frame app-lock-frame">
      <header className="app-lock-brand"><BrandMark /><span><strong>Meridium</strong><small>Keys</small></span></header>
      <main className="app-lock-stage">
        <form className="focus-card app-lock-card" onSubmit={unlock}>
          <div className="security-emblem"><Icon name="lock" size={31} /></div>
          <div className="card-copy">
            <p className="eyebrow">App locked</p>
            <h1>Unlock Meridium Keys</h1>
            <p className="lede">Enter the app password to connect storage or open a vault.</p>
          </div>
          <label className="field">
            <span>App password</span>
            <div className="secret-input">
              <input autoCapitalize="none" autoCorrect="off" autoFocus autoComplete="current-password" disabled={isChecking} enterKeyHint="go" name="appPassword" required spellCheck={false} type={showPassword ? 'text' : 'password'} />
              <button aria-label={showPassword ? 'Hide app password' : 'Show app password'} onClick={() => setShowPassword((current) => !current)} type="button"><Icon name={showPassword ? 'eye-off' : 'eye'} /></button>
            </div>
          </label>
          <p className="field-note">Use the Meridium Keys app password, not a vault’s separate master password.</p>
          {error && <p className="unlock-error" role="alert">{error}</p>}
          <button className="button button-primary button-wide" disabled={isChecking} type="submit"><Icon name="key" />{isChecking ? 'Checking…' : 'Unlock app'}</button>
        </form>
      </main>
      <UpdatePrompt />
    </div>
  )
}

function KeysWorkspace({ onLockApp }: { onLockApp: () => void }) {
  const [view, setView] = useState<View>('connect')
  const [selectedFile, setSelectedFile] = useState('')
  const [vaultName, setVaultName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordGuideOpen, setPasswordGuideOpen] = useState(false)
  const [formTouched, setFormTouched] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createStage, setCreateStage] = useState<CreateVaultStage | 'uploading' | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.matchMedia('(max-width: 720px)').matches)
  const dropbox = useDropbox()
  const pwa = usePwaLifecycle()
  const [selectedVaultFile, setSelectedVaultFile] = useState<File | null>(null)
  const [selectedStorage, setSelectedStorage] = useState<'device' | 'dropbox' | null>(null)
  const [activeDropboxVaultId, setActiveDropboxVaultId] = useState('')
  const [activeDropboxVault, setActiveDropboxVault] = useState<DropboxVaultFile | null>(null)
  const [openingDropboxVaultId, setOpeningDropboxVaultId] = useState('')
  const [vaultToDelete, setVaultToDelete] = useState<DropboxVaultFile | null>(null)
  const [deletingDropboxVaultId, setDeletingDropboxVaultId] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [vaultSnapshot, setVaultSnapshot] = useState<VaultSnapshot | null>(null)
  const [unlockError, setUnlockError] = useState('')
  const [unlockStage, setUnlockStage] = useState<UnlockStage | null>(null)
  const [isUnlocking, setIsUnlocking] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const vaultSessionRef = useRef<UnlockedVaultSession | null>(null)
  const vaultPasswordInputRef = useRef<HTMLInputElement>(null)
  const dropboxConnected = dropbox.isConnected
  const totalVaults = dropbox.vaults.length + (selectedStorage === 'device' && selectedFile ? 1 : 0)
  const activeView = dropbox.isConnected && view === 'connect' ? 'vaults' : view

  const passwordRequirements = vaultPasswordRequirements(password, vaultName, confirmation)
  const passwordReady = passwordRequirements.every((requirement) => requirement.met)
  const passwordsMatch = passwordRequirements.find((requirement) => requirement.id === 'confirmation')?.met ?? false
  let proposedVaultFileName = ''
  try {
    if (vaultName.trim()) proposedVaultFileName = toVaultFileName(vaultName)
  } catch {
    proposedVaultFileName = ''
  }
  const vaultNameTaken = Boolean(proposedVaultFileName) && dropbox.vaults.some(
    (vault) => vault.pathDisplay.localeCompare(`/${proposedVaultFileName}`, undefined, { sensitivity: 'accent' }) === 0,
  )
  const createIsValid = Boolean(proposedVaultFileName) && passwordReady && !vaultNameTaken
  const profileName = dropbox.session?.accountName || 'Jack Skates'
  const profileInitials = profileName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'JS'
  const workspaceTitle = activeView === 'connect'
    ? 'Connect storage'
    : activeView === 'vaults'
      ? 'Home'
      : activeView === 'create'
        ? 'Create vault'
        : selectedFile.replace(/\.kdbx$/i, '') || 'Unlock vault'

  useEffect(() => () => vaultSessionRef.current?.close(), [])

  function openFile(file?: File, storage: 'device' | 'dropbox' = 'device') {
    if (!file) return
    vaultSessionRef.current?.close()
    vaultSessionRef.current = null
    setSelectedFile(file.name)
    setSelectedStorage(storage)
    if (storage === 'device') {
      setActiveDropboxVaultId('')
      setActiveDropboxVault(null)
    }
    setVaultSnapshot(null)
    setUnlockError('')
    if (!file.name.toLowerCase().endsWith('.kdbx')) {
      setSelectedVaultFile(null)
      setUnlockError('Choose a standard .kdbx vault file.')
    } else {
      setSelectedVaultFile(file)
    }
    setView('unlock')
  }

  async function openDropboxVault(vault: DropboxVaultFile) {
    setOpeningDropboxVaultId(vault.id)
    try {
      const file = await dropbox.download(vault)
      setActiveDropboxVaultId(vault.id)
      setActiveDropboxVault(vault)
      openFile(file, 'dropbox')
    } catch (error) {
      setUnlockError(error instanceof Error ? error.message : `${vault.name} could not be opened from Dropbox.`)
      setView('vaults')
    } finally {
      setOpeningDropboxVaultId('')
    }
  }

  function requestDeleteVault(vault: DropboxVaultFile) {
    setDeleteError('')
    setVaultToDelete(vault)
  }

  async function confirmDeleteVault() {
    if (!vaultToDelete) return
    const vault = vaultToDelete
    setDeleteError('')
    setDeletingDropboxVaultId(vault.id)

    try {
      await dropbox.remove(vault)
      if (activeDropboxVaultId === vault.id) {
        vaultSessionRef.current?.close()
        vaultSessionRef.current = null
        setActiveDropboxVaultId('')
        setActiveDropboxVault(null)
        setSelectedFile('')
        setSelectedStorage(null)
        setSelectedVaultFile(null)
        setVaultSnapshot(null)
        setUnlockError('')
        setView('vaults')
      }
      setVaultToDelete(null)
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : `${vault.name} could not be deleted from Dropbox.`)
    } finally {
      setDeletingDropboxVaultId('')
    }
  }

  async function submitUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const password = String(new FormData(form).get('masterPassword') ?? '')

    if (!selectedVaultFile) {
      setUnlockError('Choose a standard .kdbx vault file.')
      return
    }

    setUnlockError('')
    setUnlockStage('reading')
    setIsUnlocking(true)

    try {
      const opened = await openVaultSession(selectedVaultFile, password, setUnlockStage)
      vaultSessionRef.current?.close()
      vaultSessionRef.current = opened.session
      setVaultSnapshot(opened.vault)
      form.reset()
      setView('browse')
    } catch (error) {
      setUnlockError(error instanceof VaultOpenError ? error.message : 'The vault could not be opened safely.')
      window.requestAnimationFrame(() => {
        vaultPasswordInputRef.current?.focus()
        vaultPasswordInputRef.current?.select()
      })
    } finally {
      setIsUnlocking(false)
      setUnlockStage(null)
    }
  }

  function lockVault() {
    vaultSessionRef.current?.close()
    vaultSessionRef.current = null
    setVaultSnapshot(null)
    setUnlockError('')
    setView('unlock')
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormTouched(true)
    setCreateError('')

    if (!createIsValid) {
      if (!passwordReady) setPasswordGuideOpen(true)
      return
    }
    if (!dropbox.session) {
      setCreateError('Connect Dropbox before creating this vault.')
      return
    }

    const databaseName = vaultName.trim()
    const masterPassword = password
    setFormTouched(false)
    setPassword('')
    setConfirmation('')
    setPasswordGuideOpen(false)
    setCreateStage('creating')

    try {
      const file = await createVaultFile(databaseName, masterPassword, setCreateStage)
      setCreateStage('uploading')
      const uploadedVault = await dropbox.upload(file)
      setActiveDropboxVaultId(uploadedVault.id)
      setActiveDropboxVault(uploadedVault)
      setVaultName('')
      setFormTouched(false)
      openFile(file, 'dropbox')
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'The vault could not be created safely.')
    } finally {
      setCreateStage(null)
    }
  }

  function resetCreate() {
    setVaultName('')
    setPassword('')
    setConfirmation('')
    setPasswordGuideOpen(false)
    setFormTouched(false)
    setCreateError('')
    setCreateStage(null)
    setView('vaults')
  }

  async function persistPreparedVaultChange(prepared: PreparedVaultChange) {
    const session = vaultSessionRef.current
    const remoteVault = activeDropboxVault
    if (!session || !remoteVault || selectedStorage !== 'dropbox') {
      if (session) await session.finishChange(prepared.changeId, false)
      throw new Error('Open this vault from Dropbox before saving changes.')
    }

    const encryptedFile = new File([prepared.data], remoteVault.name, { type: 'application/octet-stream' })
    try {
      const updatedVault = await dropbox.save(remoteVault, encryptedFile)
      const committedVault = await session.finishChange(prepared.changeId, true)
      setActiveDropboxVault(updatedVault)
      setActiveDropboxVaultId(updatedVault.id)
      setSelectedVaultFile(encryptedFile)
      setVaultSnapshot(committedVault)
      return committedVault
    } catch (error) {
      try {
        await session.finishChange(prepared.changeId, false)
      } catch {
        session.close()
        vaultSessionRef.current = null
        setVaultSnapshot(null)
        setView('unlock')
      }
      throw error
    }
  }

  async function saveVaultEntry(entry: VaultEntryDraft) {
    const session = vaultSessionRef.current
    if (!session) throw new Error('The vault is locked. Open it again before saving an entry.')
    const prepared = await session.prepareEntrySave(entry)
    const committedVault = await persistPreparedVaultChange(prepared)
    if (!prepared.entryId) throw new Error('The entry was saved but could not be selected afterward.')
    return { entryId: prepared.entryId, vault: committedVault }
  }

  async function deleteVaultEntry(entryId: string) {
    const session = vaultSessionRef.current
    if (!session) throw new Error('The vault is locked. Open it again before deleting an entry.')
    return persistPreparedVaultChange(await session.prepareEntryDelete(entryId))
  }

  async function moveVaultEntry(entryId: string, groupId: string) {
    const session = vaultSessionRef.current
    if (!session) throw new Error('The vault is locked. Open it again before moving an entry.')
    const prepared = await session.prepareEntryMove(entryId, groupId)
    const committedVault = await persistPreparedVaultChange(prepared)
    return { entryId: prepared.entryId || entryId, vault: committedVault }
  }

  async function saveVaultGroup(group: VaultGroupDraft) {
    const session = vaultSessionRef.current
    if (!session) throw new Error('The vault is locked. Open it again before saving a folder.')
    const prepared = await session.prepareGroupSave(group)
    const committedVault = await persistPreparedVaultChange(prepared)
    if (!prepared.groupId) throw new Error('The folder was saved but could not be selected afterward.')
    return { groupId: prepared.groupId, vault: committedVault }
  }

  async function deleteVaultGroup(groupId: string) {
    const session = vaultSessionRef.current
    if (!session) throw new Error('The vault is locked. Open it again before deleting a folder.')
    return persistPreparedVaultChange(await session.prepareGroupDelete(groupId))
  }

  return (
    <div className={`app-frame ${sidebarCollapsed ? 'has-collapsed-sidebar' : ''}`}>
      <aside className={`vault-sidebar ${sidebarCollapsed ? 'is-collapsed' : ''}`} aria-label="Vault navigation">
        <div className="sidebar-header">
          <button
            className="brand-button"
            aria-label={sidebarCollapsed ? 'Expand vault navigation' : 'Meridium Keys home'}
            onClick={() => sidebarCollapsed ? setSidebarCollapsed(false) : setView('connect')}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Meridium Keys'}
            type="button"
          >
            <BrandMark />
            <span className="sidebar-brand-copy"><strong>Meridium</strong><small>Keys</small></span>
          </button>
          {!sidebarCollapsed && (
            <button
              className="sidebar-collapse"
              aria-label="Collapse vault navigation"
              aria-expanded="true"
              onClick={() => setSidebarCollapsed(true)}
              title="Collapse sidebar"
              type="button"
            >
              <Icon name="chevron-left" size={18} />
            </button>
          )}
        </div>

        <nav className="vault-navigation">
          <button
            className={`sidebar-row sidebar-row-all ${activeView === 'vaults' || activeView === 'create' ? 'is-active' : ''}`}
            onClick={() => setView(dropboxConnected ? 'vaults' : 'connect')}
            title="Home"
            type="button"
          >
            <span className="sidebar-row-icon"><Icon name="key" /></span>
            <span className="sidebar-row-copy"><strong>Home</strong><small>{totalVaults ? `${totalVaults} ${totalVaults === 1 ? 'vault' : 'vaults'}` : 'No vaults'}</small></span>
          </button>

          <div className="sidebar-section">
            <div className="sidebar-section-label"><span>On this device</span></div>
            {selectedFile && selectedStorage === 'device' ? (
              <button className={`sidebar-row vault-row ${activeView === 'unlock' || activeView === 'browse' ? 'is-active' : ''}`} onClick={() => setView(vaultSnapshot ? 'browse' : 'unlock')} title={selectedFile} type="button">
                <span className="vault-avatar">{selectedFile.slice(0, 1).toUpperCase()}<span className="vault-lock"><Icon name={vaultSnapshot ? 'check' : 'lock'} size={11} /></span></span>
                <span className="sidebar-row-copy"><strong>{selectedFile.replace(/\.kdbx$/i, '')}</strong><small>{vaultSnapshot ? 'Open · read only' : 'Locked'}</small></span>
              </button>
            ) : (
              <p className="sidebar-empty">No local vault selected</p>
            )}
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-label"><span>On Dropbox</span></div>
            {dropbox.vaults.map((vault) => (
              <div className="sidebar-vault-item" key={vault.id}>
                <button
                  className={`sidebar-row vault-row ${activeDropboxVaultId === vault.id && (activeView === 'unlock' || activeView === 'browse') ? 'is-active' : ''}`}
                  disabled={Boolean(openingDropboxVaultId || deletingDropboxVaultId)}
                  onClick={() => void openDropboxVault(vault)}
                  title={vault.pathDisplay}
                  type="button"
                >
                  <span className="vault-avatar">{vault.name.slice(0, 1).toUpperCase()}<span className="vault-lock"><Icon name={activeDropboxVaultId === vault.id && vaultSnapshot ? 'check' : 'lock'} size={11} /></span></span>
                  <span className="sidebar-row-copy"><strong>{vault.name.replace(/\.kdbx$/i, '')}</strong><small>{openingDropboxVaultId === vault.id ? 'Downloading…' : activeDropboxVaultId === vault.id && vaultSnapshot ? 'Open · editable' : 'Dropbox · locked'}</small></span>
                </button>
                <button
                  aria-haspopup="dialog"
                  aria-label={`Delete ${vault.name.replace(/\.kdbx$/i, '')} from Dropbox`}
                  className="sidebar-vault-delete"
                  disabled={Boolean(openingDropboxVaultId || deletingDropboxVaultId)}
                  onClick={() => requestDeleteVault(vault)}
                  title={`Delete ${vault.name.replace(/\.kdbx$/i, '')} from Dropbox`}
                  type="button"
                >
                  <Icon name="trash" size={15} />
                </button>
              </div>
            ))}
            {!dropbox.vaults.length && <p className="sidebar-empty">{dropbox.status === 'loading' || dropbox.status === 'connecting' ? 'Connecting…' : dropboxConnected ? 'No vaults found' : 'Not connected'}</p>}
            <button className="sidebar-row sidebar-new-vault" onClick={() => setView(dropboxConnected ? 'create' : 'connect')} title="New vault" type="button">
              <span className="sidebar-row-icon sidebar-row-icon-dashed"><Icon name="plus" /></span>
              <span className="sidebar-row-copy"><strong>New vault</strong><small>Create in Dropbox</small></span>
            </button>
          </div>
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-connection" disabled={!pwa.isOnline} onClick={() => dropboxConnected ? setView('vaults') : void dropbox.connect()} title={!pwa.isOnline ? 'Device is offline' : dropboxConnected ? 'Dropbox ready' : 'Dropbox disconnected'} type="button">
            <span className={`status-dot ${pwa.isOnline && dropboxConnected ? 'is-ready' : ''}`} />
            <span className="sidebar-row-copy"><strong>Dropbox</strong><small>{!pwa.isOnline ? 'Offline' : dropbox.status === 'connecting' || dropbox.status === 'loading' ? 'Connecting' : dropboxConnected ? 'Ready' : dropbox.status === 'error' ? 'Needs attention' : 'Disconnected'}</small></span>
          </button>
          <button className="sidebar-sign-out" onClick={() => { vaultSessionRef.current?.close(); vaultSessionRef.current = null; dropbox.disconnect(); onLockApp() }} type="button">Sign out</button>
          <div className="sidebar-profile" title={profileName}>
            <span className="profile-avatar">{profileInitials}</span>
            <span className="sidebar-row-copy"><strong>{profileName}</strong><small>User profile</small></span>
          </div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <strong className="workspace-title">{workspaceTitle}</strong>
          <div className="topbar-actions">
            <div className={`connection-status ${pwa.isOnline && dropboxConnected ? 'is-connected' : ''} ${!pwa.isOnline ? 'is-offline' : ''}`}>
              <span className="status-dot" />
              <span>{!pwa.isOnline ? 'Offline' : dropbox.status === 'connecting' || dropbox.status === 'loading' ? 'Connecting Dropbox' : dropboxConnected ? 'Dropbox ready' : 'Not connected'}</span>
            </div>
            <button className="topbar-lock" aria-label="Lock Meridium Keys" onClick={() => { vaultSessionRef.current?.close(); vaultSessionRef.current = null; onLockApp() }} title="Lock app" type="button"><Icon name="lock" size={18} /></button>
          </div>
        </header>

        <section className={`content-stage ${activeView === 'browse' ? 'is-vault-open' : ''}`}>
          {activeView === 'connect' && (
            <div className="focus-card connect-card">
              <div className="security-emblem"><Icon name="shield" size={32} /></div>
              <div className="card-copy">
                <p className="eyebrow">No account required</p>
                <h1>Connect your vault storage</h1>
                <p className="lede">Connect Dropbox to create or open encrypted KDBX vaults. Your master passwords stay on this device.</p>
              </div>
              <div className="card-actions">
                <button className="button button-primary" disabled={!pwa.isOnline || dropbox.status === 'connecting'} onClick={() => void dropbox.connect()} type="button"><Icon name="cloud" />{!pwa.isOnline ? 'Dropbox requires a connection' : dropbox.status === 'connecting' ? 'Opening Dropbox…' : 'Connect Dropbox'}</button>
                <button className="button button-secondary" onClick={() => fileInputRef.current?.click()} type="button"><Icon name="file" />Open KDBX from device</button>
              </div>
              {dropbox.error && <p className="unlock-error" role="alert">{dropbox.error}</p>}
              <p className="privacy-note"><Icon name="lock" size={15} /> Dropbox receives encrypted vault files only.</p>
            </div>
          )}

          {activeView === 'vaults' && (
            <div className="vault-chooser">
              <h1 className="visually-hidden">Vault actions</h1>
              <div className="choice-grid">
                <button className="choice-card choice-primary" onClick={() => setView('create')} type="button">
                  <span className="choice-icon"><Icon name="plus" size={26} /></span>
                  <span className="choice-card-copy"><strong>Create a new vault</strong><small>Set its name and independent master password.</small></span>
                </button>
                <button className="choice-card" onClick={() => fileInputRef.current?.click()} type="button">
                  <span className="choice-icon"><Icon name="folder" size={25} /></span>
                  <span className="choice-card-copy"><strong>Open an existing vault</strong><small>Choose a standard KDBX file from this device.</small></span>
                </button>
              </div>

              {dropbox.error && <p className="unlock-error" role="alert">{dropbox.error}</p>}
            </div>
          )}

          {activeView === 'create' && (
            <form className="focus-card create-card" onSubmit={submitCreate}>
              <button className="back-button" disabled={Boolean(createStage)} onClick={resetCreate} type="button"><Icon name="arrow-left" /> Back to vaults</button>
              <div className="card-copy">
                <p className="eyebrow">New vault</p>
                <h1>Create your vault</h1>
                <p className="lede">This master password protects only this standard KDBX vault. Store it safely; recovery phrases are not enabled yet.</p>
              </div>

              <div className="form-stack">
                <label className="field">
                  <span>Vault name</span>
                  <input autoComplete="off" disabled={Boolean(createStage)} onChange={(event) => { setVaultName(event.target.value); setCreateError('') }} placeholder="Personal" required value={vaultName} />
                  {vaultNameTaken && <small className="field-error">That vault already exists. Open it from Home or choose another name.</small>}
                </label>
                <div
                  className="password-creation"
                  onBlurCapture={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPasswordGuideOpen(false)
                  }}
                  onFocusCapture={() => setPasswordGuideOpen(true)}
                >
                  <label className="field">
                    <span>Master password</span>
                    <div className="secret-input">
                      <input
                        aria-describedby={passwordGuideOpen ? 'vault-password-requirements' : undefined}
                        aria-invalid={formTouched && !passwordReady}
                        autoCapitalize="none"
                        autoComplete="off"
                        autoCorrect="off"
                        disabled={Boolean(createStage)}
                        maxLength={128}
                        minLength={15}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="A few unrelated words work well"
                        required
                        spellCheck={false}
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                      />
                      <button aria-label={showPassword ? 'Hide master password' : 'Show master password'} aria-pressed={showPassword} disabled={Boolean(createStage)} onClick={() => setShowPassword((current) => !current)} type="button"><Icon name={showPassword ? 'eye-off' : 'eye'} /></button>
                    </div>
                    <small className={formTouched && !passwordReady ? 'field-error' : ''}>Spaces and pasted passphrases are welcome.</small>
                  </label>

                  {passwordGuideOpen && (
                    <aside className="password-requirements" id="vault-password-requirements">
                      <strong>{passwordReady ? 'Password ready' : 'Your password needs:'}</strong>
                      <ul aria-label="Password requirements">
                        {passwordRequirements.map((requirement) => (
                          <li className={requirement.met ? 'is-met' : ''} data-met={requirement.met} key={requirement.id}>
                            <span aria-hidden="true" className="password-rule-icon">{requirement.met && <Icon name="check" size={13} />}</span>
                            <span>{requirement.label}<span className="visually-hidden"> — {requirement.met ? 'met' : 'not yet met'}</span></span>
                          </li>
                        ))}
                      </ul>
                      <p aria-live="polite" role="status">{passwordRequirements.filter((requirement) => requirement.met).length} of {passwordRequirements.length} requirements met</p>
                    </aside>
                  )}

                  <label className="field">
                    <span>Confirm master password</span>
                    <input aria-invalid={formTouched && !passwordsMatch} autoCapitalize="none" autoComplete="off" autoCorrect="off" disabled={Boolean(createStage)} maxLength={128} minLength={15} onChange={(event) => setConfirmation(event.target.value)} required spellCheck={false} type={showPassword ? 'text' : 'password'} value={confirmation} />
                    {formTouched && !passwordsMatch && <small className="field-error">The passwords must match.</small>}
                  </label>
                </div>
              </div>

              <div className="recovery-option recovery-pending">
                <span className="recovery-status-icon"><Icon name="shield" size={18} /></span>
                <span><strong>Recovery phrase coming later</strong><small>This vault remains fully compatible with KeePass apps. Do not lose its master password.</small></span>
              </div>

              {createError && <p className="unlock-error" role="alert">{createError}</p>}
              <button className="button button-primary button-wide" disabled={Boolean(createStage)} type="submit">
                {createStage && <Icon name={createStage === 'uploading' ? 'cloud' : 'shield'} />}
                {createStage === 'creating'
                  ? 'Preparing vault…'
                  : createStage === 'encrypting'
                    ? 'Encrypting vault…'
                    : createStage === 'uploading'
                      ? 'Saving to Dropbox…'
                      : 'Create encrypted vault'}
                {!createStage && <Icon name="chevron-right" />}
              </button>
            </form>
          )}

          {activeView === 'unlock' && (
            <form className="focus-card unlock-card" onSubmit={submitUnlock}>
              <button className="back-button" onClick={() => setView('vaults')} type="button"><Icon name="arrow-left" /> Back to vaults</button>
              <div className="vault-seal"><span>{selectedFile.slice(0, 1).toUpperCase()}</span><span className="seal-lock"><Icon name="lock" size={14} /></span></div>
              <div className="card-copy">
                <p className="eyebrow">Locked vault</p>
                <h1>{selectedFile.replace(/\.kdbx$/i, '')}</h1>
                <p className="lede">Enter this vault's master password. It will not be saved.</p>
              </div>
              <label className="field">
                <span>Master password</span>
                <div className="secret-input"><input autoCapitalize="none" autoComplete="off" autoCorrect="off" autoFocus disabled={isUnlocking} name="masterPassword" ref={vaultPasswordInputRef} required spellCheck={false} type={showPassword ? 'text' : 'password'} /><button aria-label={showPassword ? 'Hide master password' : 'Show master password'} onClick={() => setShowPassword((current) => !current)} type="button"><Icon name={showPassword ? 'eye-off' : 'eye'} /></button></div>
              </label>
              <p className="field-note">Vault passwords are case-sensitive. Every space and punctuation mark must match exactly.</p>
              {unlockError && <p className="unlock-error" role="alert">{unlockError}</p>}
              <button className="button button-primary button-wide" disabled={isUnlocking} type="submit"><Icon name="key" />{isUnlocking ? `${unlockStage === 'mapping' ? 'Preparing' : unlockStage === 'reading' ? 'Reading' : 'Decrypting'} vault…` : 'Unlock vault'}</button>
              <button className="text-button" disabled={isUnlocking} onClick={() => fileInputRef.current?.click()} type="button">Choose another KDBX file</button>
            </form>
          )}

          {activeView === 'browse' && vaultSnapshot && (
            <VaultBrowser
              canEdit={selectedStorage === 'dropbox' && Boolean(activeDropboxVault)}
              onDeleteGroup={deleteVaultGroup}
              onDeleteEntry={deleteVaultEntry}
              onLoadEntry={(entryId) => {
                const session = vaultSessionRef.current
                return session ? session.getEntry(entryId) : Promise.reject(new Error('The vault is locked. Open it again before editing an entry.'))
              }}
              onLock={lockVault}
              onMoveEntry={moveVaultEntry}
              onSaveGroup={saveVaultGroup}
              onSaveEntry={saveVaultEntry}
              vault={vaultSnapshot}
            />
          )}
        </section>

      </main>

      <input accept=".kdbx,application/octet-stream" aria-hidden="true" className="visually-hidden" onChange={(event) => { openFile(event.target.files?.[0]); event.currentTarget.value = '' }} ref={fileInputRef} tabIndex={-1} type="file" />
      {vaultToDelete && (
        <DeleteVaultDialog
          error={deleteError}
          isDeleting={deletingDropboxVaultId === vaultToDelete.id}
          onCancel={() => {
            if (!deletingDropboxVaultId) {
              setDeleteError('')
              setVaultToDelete(null)
            }
          }}
          onDelete={() => void confirmDeleteVault()}
          vault={vaultToDelete}
        />
      )}
      <InstallPrompt canPromptInstall={pwa.canPromptInstall} install={pwa.install} isIos={pwa.isIos} isStandalone={pwa.isStandalone} />
      <UpdatePrompt />
    </div>
  )
}

const appLockSessionKey = 'meridium-keys-app-unlocked'

function App() {
  const [isUnlocked, setIsUnlocked] = useState(() => sessionStorage.getItem(appLockSessionKey) === 'true')

  function unlockApp() {
    sessionStorage.setItem(appLockSessionKey, 'true')
    setIsUnlocked(true)
  }

  function lockApp() {
    sessionStorage.removeItem(appLockSessionKey)
    setIsUnlocked(false)
  }

  return isUnlocked ? <KeysWorkspace onLockApp={lockApp} /> : <AppLock onUnlock={unlockApp} />
}

export default App
