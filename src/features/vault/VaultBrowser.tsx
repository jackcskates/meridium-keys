import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { VaultEntryDetails, VaultEntryDraft, VaultEntrySummary, VaultSnapshot } from './types'

type VaultBrowserProps = {
  vault: VaultSnapshot
  canEdit: boolean
  onDeleteEntry: (entryId: string) => Promise<VaultSnapshot>
  onLoadEntry: (entryId: string) => Promise<VaultEntryDetails>
  onLock: () => void
  onSaveEntry: (entry: VaultEntryDraft) => Promise<{ entryId: string; vault: VaultSnapshot }>
}

function entrySubtitle(entry: VaultEntrySummary) {
  return entry.username || entry.url || 'No username or URL'
}

function DeleteEntryDialog({ entry, isDeleting, error, onCancel, onDelete }: {
  entry: VaultEntrySummary
  isDeleting: boolean
  error: string
  onCancel: () => void
  onDelete: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

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
      aria-describedby="delete-entry-description"
      aria-labelledby="delete-entry-title"
      className="confirm-dialog"
      onCancel={(event) => {
        event.preventDefault()
        if (!isDeleting) onCancel()
      }}
      ref={dialogRef}
    >
      <div className="confirm-dialog-card">
        <div className="confirm-dialog-copy">
          <p className="eyebrow">Delete entry</p>
          <h2 id="delete-entry-title">Delete {entry.title}?</h2>
          <p id="delete-entry-description">The entry will move to the standard KDBX Recycle Bin and the encrypted vault will be saved to Dropbox.</p>
        </div>
        {error && <p className="unlock-error" role="alert">{error}</p>}
        <div className="confirm-dialog-actions">
          <button className="button button-secondary" disabled={isDeleting} onClick={onCancel} ref={cancelRef} type="button">Cancel</button>
          <button className="button button-danger" disabled={isDeleting} onClick={onDelete} type="button">{isDeleting ? 'Deleting…' : `Delete ${entry.title}`}</button>
        </div>
      </div>
    </dialog>
  )
}

export function VaultBrowser({ vault, canEdit, onDeleteEntry, onLoadEntry, onLock, onSaveEntry }: VaultBrowserProps) {
  const [selectedGroupId, setSelectedGroupId] = useState('all')
  const activeEntries = useMemo(() => vault.entries.filter((entry) => !entry.isDeleted), [vault.entries])
  const visibleEntries = useMemo(
    () => selectedGroupId === 'all'
      ? activeEntries
      : vault.entries.filter((entry) => entry.groupId === selectedGroupId),
    [activeEntries, selectedGroupId, vault.entries],
  )
  const [selectedEntryId, setSelectedEntryId] = useState(activeEntries[0]?.id ?? '')
  const selectedEntry = visibleEntries.find((entry) => entry.id === selectedEntryId) ?? visibleEntries[0]
  const [draft, setDraft] = useState<VaultEntryDraft | null>(null)
  const [showDraftPassword, setShowDraftPassword] = useState(false)
  const [isLoadingEntry, setIsLoadingEntry] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [entryToDelete, setEntryToDelete] = useState<VaultEntrySummary | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  function selectGroup(groupId: string) {
    setSelectedGroupId(groupId)
    const firstEntry = groupId === 'all'
      ? activeEntries[0]
      : vault.entries.find((entry) => entry.groupId === groupId)
    setSelectedEntryId(firstEntry?.id ?? '')
    setDraft(null)
    setSaveError('')
  }

  function beginCreate() {
    const selectedGroup = vault.groups.find((group) => group.id === selectedGroupId && !group.isRecycleBin)
    const groupId = selectedGroup?.id || vault.groups.find((group) => !group.isRecycleBin)?.id || ''
    setDraft({ groupId, title: '', username: '', password: '', url: '', notes: '' })
    setShowDraftPassword(false)
    setSaveError('')
  }

  async function beginEdit(entry: VaultEntrySummary) {
    setIsLoadingEntry(true)
    setSaveError('')
    try {
      setDraft(await onLoadEntry(entry.id))
      setShowDraftPassword(false)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'That entry could not be prepared for editing.')
    } finally {
      setIsLoadingEntry(false)
    }
  }

  async function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft) return
    setIsSaving(true)
    setSaveError('')
    try {
      const saved = await onSaveEntry(draft)
      setSelectedEntryId(saved.entryId)
      setDraft(null)
      setShowDraftPassword(false)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'The encrypted vault could not be saved.')
    } finally {
      setIsSaving(false)
    }
  }

  async function deleteEntry() {
    if (!entryToDelete) return
    setIsDeleting(true)
    setDeleteError('')
    try {
      await onDeleteEntry(entryToDelete.id)
      setSelectedEntryId('')
      setEntryToDelete(null)
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'The entry could not be deleted safely.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="vault-browser">
      <header className="vault-browser-header">
        <div>
          <p className="eyebrow">KDBX {vault.version}</p>
          <h1>{vault.databaseName}</h1>
          <p>{activeEntries.length} {activeEntries.length === 1 ? 'entry' : 'entries'} · decrypted in memory</p>
        </div>
        <div className="vault-browser-actions">
          <button className="button button-primary" disabled={!canEdit || isSaving || isDeleting} onClick={beginCreate} title={canEdit ? 'Add entry' : 'Dropbox vaults can be edited; local files remain read only.'} type="button">Add entry</button>
          <button className="button button-secondary" onClick={onLock} type="button">Lock vault</button>
        </div>
      </header>

      {!canEdit && <p className="read-only-note">This device file is open read only. Connect and open its Dropbox copy to add or edit entries.</p>}

      <div className="vault-browser-grid">
        <aside className="group-list" aria-label="Vault groups">
          <h2>Groups</h2>
          <button className={selectedGroupId === 'all' ? 'is-selected' : ''} onClick={() => selectGroup('all')} type="button">
            <span>All entries</span><small>{activeEntries.length}</small>
          </button>
          {vault.groups.map((group) => (
            <button
              className={selectedGroupId === group.id ? 'is-selected' : ''}
              key={group.id}
              onClick={() => selectGroup(group.id)}
              style={{ paddingInlineStart: `${12 + group.depth * 12}px` }}
              title={group.path}
              type="button"
            >
              <span>{group.name}</span><small>{group.entryCount}</small>
            </button>
          ))}
        </aside>

        <section className="entry-list" aria-label="Vault entries">
          <h2>Entries</h2>
          {visibleEntries.length ? visibleEntries.map((entry) => (
            <button
              className={selectedEntryId === entry.id ? 'is-selected' : ''}
              key={entry.id}
              onClick={() => { setSelectedEntryId(entry.id); setDraft(null); setSaveError('') }}
              type="button"
            >
              <span className="entry-glyph">{entry.title.slice(0, 1).toUpperCase()}</span>
              <span><strong>{entry.title}</strong><small>{entrySubtitle(entry)}</small></span>
            </button>
          )) : <p className="vault-empty-state">No entries in this group.</p>}
        </section>

        <section className="entry-detail" aria-label="Selected entry">
          {draft ? (
            <form className="entry-editor" onSubmit={saveEntry}>
              <div className="entry-editor-heading"><div><p className="eyebrow">{draft.id ? 'Edit entry' : 'New entry'}</p><h2>{draft.id ? draft.title || 'Untitled entry' : 'Add a login'}</h2></div></div>
              <label className="field"><span>Name</span><input autoFocus autoComplete="off" disabled={isSaving} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required value={draft.title} /></label>
              <label className="field"><span>Group</span><select disabled={isSaving} onChange={(event) => setDraft({ ...draft, groupId: event.target.value })} value={draft.groupId}>{vault.groups.filter((group) => !group.isRecycleBin).map((group) => <option key={group.id} value={group.id}>{group.path}</option>)}</select></label>
              <label className="field"><span>Username or email</span><input autoComplete="username" disabled={isSaving} onChange={(event) => setDraft({ ...draft, username: event.target.value })} value={draft.username} /></label>
              <label className="field"><span>Password</span><div className="secret-input"><input autoComplete="new-password" disabled={isSaving} onChange={(event) => setDraft({ ...draft, password: event.target.value })} type={showDraftPassword ? 'text' : 'password'} value={draft.password} /><button aria-label={showDraftPassword ? 'Hide entry password' : 'Show entry password'} onClick={() => setShowDraftPassword((current) => !current)} type="button">{showDraftPassword ? 'Hide' : 'Show'}</button></div></label>
              <label className="field"><span>Website</span><input autoComplete="url" disabled={isSaving} inputMode="url" onChange={(event) => setDraft({ ...draft, url: event.target.value })} value={draft.url} /></label>
              <label className="field"><span>Notes</span><textarea disabled={isSaving} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} rows={3} value={draft.notes} /></label>
              {saveError && <p className="unlock-error" role="alert">{saveError}</p>}
              <div className="entry-editor-actions"><button className="button button-secondary" disabled={isSaving} onClick={() => { setDraft(null); setSaveError(''); setShowDraftPassword(false) }} type="button">Cancel</button><button className="button button-primary" disabled={isSaving} type="submit">{isSaving ? 'Encrypting and saving…' : 'Save entry'}</button></div>
            </form>
          ) : selectedEntry ? (
            <>
              <div className="entry-detail-heading">
                <span className="entry-glyph entry-glyph-large">{selectedEntry.title.slice(0, 1).toUpperCase()}</span>
                <div><p className="eyebrow">{selectedEntry.isDeleted ? 'Recycle Bin' : 'Entry'}</p><h2>{selectedEntry.title}</h2></div>
              </div>
              <dl>
                <div><dt>Username</dt><dd>{selectedEntry.username || '—'}</dd></div>
                <div><dt>Website</dt><dd>{selectedEntry.url || '—'}</dd></div>
                <div><dt>Password</dt><dd className="masked-secret">{selectedEntry.hasPassword ? '••••••••••••' : '—'}</dd></div>
              </dl>
              {saveError && <p className="unlock-error" role="alert">{saveError}</p>}
              {!selectedEntry.isDeleted && canEdit && <div className="entry-detail-actions"><button className="button button-secondary" disabled={isLoadingEntry} onClick={() => void beginEdit(selectedEntry)} type="button">{isLoadingEntry ? 'Preparing…' : 'Edit entry'}</button><button className="text-button text-button-danger" onClick={() => { setDeleteError(''); setEntryToDelete(selectedEntry) }} type="button">Delete entry</button></div>}
              <p className="read-only-note">Passwords stay encrypted in KDBX and appear only inside the editor while this vault is unlocked.</p>
            </>
          ) : <p className="vault-empty-state">Choose an entry or add a new one.</p>}
        </section>
      </div>

      {entryToDelete && <DeleteEntryDialog entry={entryToDelete} error={deleteError} isDeleting={isDeleting} onCancel={() => { if (!isDeleting) { setDeleteError(''); setEntryToDelete(null) } }} onDelete={() => void deleteEntry()} />}
    </div>
  )
}
