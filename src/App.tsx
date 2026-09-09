import { useRef, useState, type FormEvent } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import type { DropboxVaultFile } from './features/dropbox/types'
import { useDropbox } from './features/dropbox/useDropbox'
import { usePwaLifecycle } from './features/pwa/usePwaLifecycle'
import { VaultBrowser } from './features/vault/VaultBrowser'
import { VaultOpenError } from './features/vault/kdbx'
import type { VaultSnapshot } from './features/vault/types'
import { unlockVaultFile, type UnlockStage } from './features/vault/unlockVault'
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
  }

  return (
    <svg aria-hidden="true" className="icon" fill="none" height={size} viewBox="0 0 24 24" width={size}>
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
        {paths[name]}
      </g>
    </svg>
  )
}

function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

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

function App() {
  const [view, setView] = useState<View>('connect')
  const [selectedFile, setSelectedFile] = useState('')
  const [vaultName, setVaultName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [formTouched, setFormTouched] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.matchMedia('(max-width: 720px)').matches)
  const dropbox = useDropbox()
  const pwa = usePwaLifecycle()
  const [selectedVaultFile, setSelectedVaultFile] = useState<File | null>(null)
  const [selectedStorage, setSelectedStorage] = useState<'device' | 'dropbox' | null>(null)
  const [activeDropboxVaultId, setActiveDropboxVaultId] = useState('')
  const [openingDropboxVaultId, setOpeningDropboxVaultId] = useState('')
  const [vaultSnapshot, setVaultSnapshot] = useState<VaultSnapshot | null>(null)
  const [unlockError, setUnlockError] = useState('')
  const [unlockStage, setUnlockStage] = useState<UnlockStage | null>(null)
  const [isUnlocking, setIsUnlocking] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropboxConnected = dropbox.isConnected
  const totalVaults = dropbox.vaults.length + (selectedStorage === 'device' && selectedFile ? 1 : 0)
  const activeView = dropbox.isConnected && view === 'connect' ? 'vaults' : view

  const passwordsMatch = password.length > 0 && password === confirmation
  const createIsValid = vaultName.trim().length > 0 && password.length >= 12 && passwordsMatch
  const workspaceTitle = activeView === 'connect'
    ? 'Connect storage'
    : activeView === 'vaults'
      ? 'All vaults'
      : activeView === 'create'
        ? 'Create vault'
        : selectedFile.replace(/\.kdbx$/i, '') || 'Unlock vault'

  function openFile(file?: File, storage: 'device' | 'dropbox' = 'device') {
    if (!file) return
    setSelectedFile(file.name)
    setSelectedStorage(storage)
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
      openFile(file, 'dropbox')
    } catch (error) {
      setUnlockError(error instanceof Error ? error.message : `${vault.name} could not be opened from Dropbox.`)
      setView('vaults')
    } finally {
      setOpeningDropboxVaultId('')
    }
  }

  async function submitUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const password = String(new FormData(form).get('masterPassword') ?? '')
    form.reset()

    if (!selectedVaultFile) {
      setUnlockError('Choose a standard .kdbx vault file.')
      return
    }

    setUnlockError('')
    setUnlockStage('reading')
    setIsUnlocking(true)

    try {
      const snapshot = await unlockVaultFile(selectedVaultFile, password, setUnlockStage)
      setVaultSnapshot(snapshot)
      setView('browse')
    } catch (error) {
      setUnlockError(error instanceof VaultOpenError ? error.message : 'The vault could not be opened safely.')
    } finally {
      setIsUnlocking(false)
      setUnlockStage(null)
    }
  }

  function lockVault() {
    setVaultSnapshot(null)
    setUnlockError('')
    setView('unlock')
  }

  function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormTouched(true)
  }

  function resetCreate() {
    setVaultName('')
    setPassword('')
    setConfirmation('')
    setFormTouched(false)
    setView('vaults')
  }

  return (
    <div className={`app-frame ${sidebarCollapsed ? 'has-collapsed-sidebar' : ''}`}>
      <aside className={`vault-sidebar ${sidebarCollapsed ? 'is-collapsed' : ''}`} aria-label="Vault navigation">
        <div className="sidebar-header">
          <button className="brand-button" aria-label="Meridium Keys home" onClick={() => setView('connect')} title="Meridium Keys" type="button">
            <BrandMark />
            <span className="sidebar-brand-copy"><strong>Meridium</strong><small>Keys</small></span>
          </button>
          <button
            className="sidebar-collapse"
            aria-label={sidebarCollapsed ? 'Expand vault navigation' : 'Collapse vault navigation'}
            aria-expanded={!sidebarCollapsed}
            onClick={() => setSidebarCollapsed((current) => !current)}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            type="button"
          >
            <Icon name={sidebarCollapsed ? 'chevron-right' : 'chevron-left'} size={18} />
          </button>
        </div>

        <nav className="vault-navigation">
          <button
            className={`sidebar-row sidebar-row-all ${activeView === 'vaults' || activeView === 'create' ? 'is-active' : ''}`}
            onClick={() => setView(dropboxConnected ? 'vaults' : 'connect')}
            title="All vaults"
            type="button"
          >
            <span className="sidebar-row-icon"><Icon name="key" /></span>
            <span className="sidebar-row-copy"><strong>All vaults</strong><small>{totalVaults ? `${totalVaults} ${totalVaults === 1 ? 'vault' : 'vaults'}` : 'No vaults'}</small></span>
          </button>

          <div className="sidebar-section">
            <div className="sidebar-section-label"><span>On this device</span><Icon name="file" size={16} /></div>
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
            <div className="sidebar-section-label"><span>On Dropbox</span><Icon name="cloud" size={16} /></div>
            {dropbox.vaults.map((vault) => (
              <button
                className={`sidebar-row vault-row ${activeDropboxVaultId === vault.id && (activeView === 'unlock' || activeView === 'browse') ? 'is-active' : ''}`}
                disabled={Boolean(openingDropboxVaultId)}
                key={vault.id}
                onClick={() => void openDropboxVault(vault)}
                title={vault.pathDisplay}
                type="button"
              >
                <span className="vault-avatar">{vault.name.slice(0, 1).toUpperCase()}<span className="vault-lock"><Icon name={activeDropboxVaultId === vault.id && vaultSnapshot ? 'check' : 'lock'} size={11} /></span></span>
                <span className="sidebar-row-copy"><strong>{vault.name.replace(/\.kdbx$/i, '')}</strong><small>{openingDropboxVaultId === vault.id ? 'Downloading…' : activeDropboxVaultId === vault.id && vaultSnapshot ? 'Open · read only' : 'Dropbox · locked'}</small></span>
              </button>
            ))}
            {!dropbox.vaults.length && <p className="sidebar-empty">{dropbox.status === 'loading' || dropbox.status === 'connecting' ? 'Connecting…' : dropboxConnected ? 'No vaults found' : 'Not connected'}</p>}
            <button className="sidebar-row sidebar-new-vault" onClick={() => setView(dropboxConnected ? 'create' : 'connect')} title="New vault" type="button">
              <span className="sidebar-row-icon sidebar-row-icon-dashed"><Icon name="plus" /></span>
              <span className="sidebar-row-copy"><strong>New vault</strong><small>Create in Dropbox</small></span>
            </button>
          </div>
        </nav>

        <button className="sidebar-connection" disabled={!pwa.isOnline} onClick={() => dropboxConnected ? setView('vaults') : void dropbox.connect()} title={!pwa.isOnline ? 'Device is offline' : dropboxConnected ? 'Dropbox ready' : 'Dropbox disconnected'} type="button">
          <span className={`status-dot ${pwa.isOnline && dropboxConnected ? 'is-ready' : ''}`} />
          <span className="sidebar-row-copy"><strong>Dropbox</strong><small>{!pwa.isOnline ? 'Offline' : dropbox.status === 'connecting' || dropbox.status === 'loading' ? 'Connecting' : dropboxConnected ? 'Ready' : dropbox.status === 'error' ? 'Needs attention' : 'Disconnected'}</small></span>
        </button>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <strong className="workspace-title">{workspaceTitle}</strong>
          <div className={`connection-status ${pwa.isOnline && dropboxConnected ? 'is-connected' : ''} ${!pwa.isOnline ? 'is-offline' : ''}`}>
            <span className="status-dot" />
            <span>{!pwa.isOnline ? 'Offline' : dropbox.status === 'connecting' || dropbox.status === 'loading' ? 'Connecting Dropbox' : dropboxConnected ? 'Dropbox ready' : 'Not connected'}</span>
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
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Vaults</p>
                  <h1>Choose where to begin</h1>
                  <p>Open an encrypted vault or create a new one in your Dropbox folder.</p>
                </div>
                <span className="secure-pill"><Icon name="check" size={14} /> {dropbox.session?.accountName || 'Connected'}</span>
              </div>

              <div className="choice-grid">
                <button className="choice-card choice-primary" onClick={() => setView('create')} type="button">
                  <span className="choice-icon"><Icon name="plus" size={26} /></span>
                  <span><strong>Create a new vault</strong><small>Set a name, master password, and recovery option.</small></span>
                  <Icon name="chevron-right" />
                </button>
                <button className="choice-card" onClick={() => fileInputRef.current?.click()} type="button">
                  <span className="choice-icon"><Icon name="folder" size={25} /></span>
                  <span><strong>Open an existing vault</strong><small>Choose a standard KDBX file from Dropbox or this device.</small></span>
                  <Icon name="chevron-right" />
                </button>
              </div>

              {dropbox.error && <p className="unlock-error" role="alert">{dropbox.error}</p>}
              {dropbox.vaults.length ? (
                <div className="dropbox-vault-list" aria-label="Dropbox vaults">
                  {dropbox.vaults.map((vault) => (
                    <button disabled={Boolean(openingDropboxVaultId)} key={vault.id} onClick={() => void openDropboxVault(vault)} type="button">
                      <span className="vault-avatar">{vault.name.slice(0, 1).toUpperCase()}</span>
                      <span><strong>{vault.name.replace(/\.kdbx$/i, '')}</strong><small>{vault.pathDisplay} · {(vault.size / 1024).toFixed(1)} KB</small></span>
                      <span>{openingDropboxVaultId === vault.id ? 'Downloading…' : 'Open'}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty-vaults">
                  <span className="empty-icon"><Icon name="cloud" /></span>
                  <div><strong>{dropbox.status === 'loading' ? 'Checking Dropbox…' : 'No vaults found yet'}</strong><span>Encrypted KDBX files in Meridium Keys will appear here.</span></div>
                  <button className="icon-button" aria-label="Check Dropbox again" disabled={dropbox.status === 'loading'} onClick={() => void dropbox.refresh()} title="Check Dropbox again" type="button"><Icon name="refresh" /></button>
                </div>
              )}
              <button className="text-button" onClick={() => { dropbox.disconnect(); setView('connect') }} type="button">Disconnect Dropbox for this session</button>
            </div>
          )}

          {activeView === 'create' && (
            <form className="focus-card create-card" onSubmit={submitCreate}>
              <button className="back-button" onClick={resetCreate} type="button"><Icon name="arrow-left" /> Back to vaults</button>
              <div className="card-copy">
                <p className="eyebrow">New vault</p>
                <h1>Create your vault</h1>
                <p className="lede">This master password protects only this vault. Meridium Keys cannot recover it without your recovery phrase.</p>
              </div>

              <div className="form-stack">
                <label className="field">
                  <span>Vault name</span>
                  <input autoComplete="off" onChange={(event) => setVaultName(event.target.value)} placeholder="Personal" value={vaultName} />
                </label>
                <label className="field">
                  <span>Master password</span>
                  <div className="secret-input">
                    <input autoComplete="new-password" onChange={(event) => setPassword(event.target.value)} placeholder="At least 12 characters" type={showPassword ? 'text' : 'password'} value={password} />
                    <button aria-label={showPassword ? 'Hide master password' : 'Show master password'} onClick={() => setShowPassword((current) => !current)} type="button"><Icon name={showPassword ? 'eye-off' : 'eye'} /></button>
                  </div>
                  <small className={formTouched && password.length < 12 ? 'field-error' : ''}>Use 12 or more characters for this prototype.</small>
                </label>
                <label className="field">
                  <span>Confirm master password</span>
                  <input autoComplete="new-password" onChange={(event) => setConfirmation(event.target.value)} type={showPassword ? 'text' : 'password'} value={confirmation} />
                  {formTouched && !passwordsMatch && <small className="field-error">The passwords must match.</small>}
                </label>
              </div>

              <label className="recovery-option">
                <input defaultChecked type="checkbox" />
                <span className="checkbox-ui"><Icon name="check" size={14} /></span>
                <span><strong>Create a 12-word recovery phrase</strong><small>Recommended. Stored separately so the KDBX vault remains compatible with other apps.</small></span>
              </label>

              <button className="button button-primary button-wide" type="submit">Create encrypted vault<Icon name="chevron-right" /></button>
              {formTouched && createIsValid && <p className="prototype-message" role="status">The setup flow is ready. Encryption and file creation are the next implementation step.</p>}
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
                <div className="secret-input"><input autoFocus autoComplete="current-password" disabled={isUnlocking} name="masterPassword" required type={showPassword ? 'text' : 'password'} /><button aria-label={showPassword ? 'Hide master password' : 'Show master password'} onClick={() => setShowPassword((current) => !current)} type="button"><Icon name={showPassword ? 'eye-off' : 'eye'} /></button></div>
              </label>
              {unlockError && <p className="unlock-error" role="alert">{unlockError}</p>}
              <button className="button button-primary button-wide" disabled={isUnlocking} type="submit"><Icon name="key" />{isUnlocking ? `${unlockStage === 'mapping' ? 'Preparing' : unlockStage === 'reading' ? 'Reading' : 'Decrypting'} vault…` : 'Unlock vault'}</button>
              <button className="text-button" disabled={isUnlocking} onClick={() => fileInputRef.current?.click()} type="button">Choose another KDBX file</button>
            </form>
          )}

          {activeView === 'browse' && vaultSnapshot && <VaultBrowser onLock={lockVault} vault={vaultSnapshot} />}
        </section>

        {import.meta.env.DEV && <div className="dev-note">UX preview · no vault files are changed</div>}
      </main>

      <input accept=".kdbx,application/octet-stream" aria-hidden="true" className="visually-hidden" onChange={(event) => { openFile(event.target.files?.[0]); event.currentTarget.value = '' }} ref={fileInputRef} tabIndex={-1} type="file" />
      <InstallPrompt canPromptInstall={pwa.canPromptInstall} install={pwa.install} isIos={pwa.isIos} isStandalone={pwa.isStandalone} />
      <UpdatePrompt />
    </div>
  )
}

export default App
