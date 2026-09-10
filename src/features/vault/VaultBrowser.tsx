import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { createEmptyEntryDraft, entryTypeDefinitions, entryTypeLabel, getEntryTypeDefinition, type EntryFieldDefinition } from './entryTypes'
import type { VaultEntryDetails, VaultEntryDraft, VaultEntrySummary, VaultGroupDraft, VaultGroupSummary, VaultSnapshot } from './types'

type VaultBrowserProps = {
  vault: VaultSnapshot
  canEdit: boolean
  onDeleteEntry: (entryId: string) => Promise<VaultSnapshot>
  onDeleteGroup: (groupId: string) => Promise<VaultSnapshot>
  onLoadEntry: (entryId: string) => Promise<VaultEntryDetails>
  onLock: () => void
  onSaveEntry: (entry: VaultEntryDraft) => Promise<{ entryId: string; vault: VaultSnapshot }>
  onSaveGroup: (group: VaultGroupDraft) => Promise<{ groupId: string; vault: VaultSnapshot }>
}

function DialogShell({ labelledBy, describedBy, children, onCancel, locked = false }: {
  labelledBy: string
  describedBy?: string
  children: React.ReactNode
  onCancel: () => void
  locked?: boolean
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    return () => { if (dialog.open) dialog.close() }
  }, [])
  return <dialog aria-describedby={describedBy} aria-labelledby={labelledBy} className="confirm-dialog" onCancel={(event) => { event.preventDefault(); if (!locked) onCancel() }} ref={dialogRef}>{children}</dialog>
}

function DeleteEntryDialog({ entry, isDeleting, error, onCancel, onDelete }: {
  entry: VaultEntrySummary
  isDeleting: boolean
  error: string
  onCancel: () => void
  onDelete: () => void
}) {
  return <DialogShell describedBy="delete-entry-description" labelledBy="delete-entry-title" locked={isDeleting} onCancel={onCancel}><div className="confirm-dialog-card">
    <div className="confirm-dialog-copy"><p className="eyebrow">Delete entry</p><h2 id="delete-entry-title">Delete {entry.title}?</h2><p id="delete-entry-description">The entry will move to the standard KDBX Recycle Bin and the encrypted vault will be saved to Dropbox.</p></div>
    {error && <p className="unlock-error" role="alert">{error}</p>}
    <div className="confirm-dialog-actions"><button className="button button-secondary" disabled={isDeleting} onClick={onCancel} type="button">Cancel</button><button className="button button-danger" disabled={isDeleting} onClick={onDelete} type="button">{isDeleting ? 'Deleting…' : `Delete ${entry.title}`}</button></div>
  </div></DialogShell>
}

function GroupNameDialog({ group, rootGroupId, isSaving, error, onCancel, onSave }: {
  group: VaultGroupSummary | null
  rootGroupId: string
  isSaving: boolean
  error: string
  onCancel: () => void
  onSave: (draft: VaultGroupDraft) => void
}) {
  const [name, setName] = useState(group?.name || '')
  return <DialogShell labelledBy="group-dialog-title" locked={isSaving} onCancel={onCancel}><form className="confirm-dialog-card" onSubmit={(event) => { event.preventDefault(); onSave({ id: group?.id, parentGroupId: group?.parentGroupId || rootGroupId, name }) }}>
    <div className="confirm-dialog-copy"><p className="eyebrow">Vault folder</p><h2 id="group-dialog-title">{group ? 'Rename folder' : 'New folder'}</h2></div>
    <label className="field"><span>Folder name</span><input autoFocus autoComplete="off" disabled={isSaving} onChange={(event) => setName(event.target.value)} required value={name} /></label>
    {error && <p className="unlock-error" role="alert">{error}</p>}
    <div className="confirm-dialog-actions"><button className="button button-secondary" disabled={isSaving} onClick={onCancel} type="button">Cancel</button><button className="button button-primary" disabled={isSaving || !name.trim()} type="submit">{isSaving ? 'Saving…' : group ? 'Rename folder' : 'Create folder'}</button></div>
  </form></DialogShell>
}

function DeleteGroupDialog({ group, isDeleting, error, onCancel, onDelete }: {
  group: VaultGroupSummary
  isDeleting: boolean
  error: string
  onCancel: () => void
  onDelete: () => void
}) {
  return <DialogShell describedBy="delete-group-description" labelledBy="delete-group-title" locked={isDeleting} onCancel={onCancel}><div className="confirm-dialog-card">
    <div className="confirm-dialog-copy"><p className="eyebrow">Delete folder</p><h2 id="delete-group-title">Delete {group.name}?</h2><p id="delete-group-description">{group.entryCount ? `This folder and its ${group.entryCount} ${group.entryCount === 1 ? 'entry' : 'entries'} will move to the standard KDBX Recycle Bin.` : 'This folder will move to the standard KDBX Recycle Bin.'}</p></div>
    {error && <p className="unlock-error" role="alert">{error}</p>}
    <div className="confirm-dialog-actions"><button className="button button-secondary" disabled={isDeleting} onClick={onCancel} type="button">Cancel</button><button className="button button-danger" disabled={isDeleting} onClick={onDelete} type="button">{isDeleting ? 'Deleting…' : `Delete ${group.name}`}</button></div>
  </div></DialogShell>
}

function EntryField({ field, value, disabled, visible, onChange, onToggle }: {
  field: EntryFieldDefinition
  value: string
  disabled: boolean
  visible: boolean
  onChange: (value: string) => void
  onToggle: () => void
}) {
  const isTextarea = field.kind === 'textarea' || field.kind === 'secret-textarea'
  const isSecret = field.kind === 'secret' || field.kind === 'secret-textarea'
  const inputType = field.kind === 'email' ? 'email' : field.kind === 'url' ? 'url' : field.kind === 'date' ? 'date' : isSecret && !visible ? 'password' : 'text'
  return <label className="field"><span>{field.label}</span>{isTextarea ? <div className={`secret-field ${isSecret && !visible ? 'is-masked' : ''}`}><textarea disabled={disabled} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} required={field.required} rows={field.kind === 'secret-textarea' ? 3 : 4} value={value} />{isSecret && <button aria-label={`${visible ? 'Hide' : 'Show'} ${field.label.toLowerCase()}`} disabled={disabled} onClick={onToggle} type="button">{visible ? 'Hide' : 'Show'}</button>}</div> : isSecret ? <div className="secret-input"><input autoComplete="new-password" disabled={disabled} onChange={(event) => onChange(event.target.value)} required={field.required} type={inputType} value={value} /><button aria-label={`${visible ? 'Hide' : 'Show'} ${field.label.toLowerCase()}`} disabled={disabled} onClick={onToggle} type="button">{visible ? 'Hide' : 'Show'}</button></div> : <input autoComplete="off" disabled={disabled} inputMode={field.kind === 'email' ? 'email' : field.kind === 'url' ? 'url' : undefined} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} required={field.required} type={inputType} value={value} />}</label>
}

export function VaultBrowser({ vault, canEdit, onDeleteEntry, onDeleteGroup, onLoadEntry, onLock, onSaveEntry, onSaveGroup }: VaultBrowserProps) {
  const [selectedGroupId, setSelectedGroupId] = useState('all')
  const activeEntries = useMemo(() => vault.entries.filter((entry) => !entry.isDeleted), [vault.entries])
  const selectedGroup = vault.groups.find((group) => group.id === selectedGroupId)
  const selectedGroupIsRecycleRoot = selectedGroup?.isRecycleBin && selectedGroup.parentGroupId === vault.rootGroupId
  const visibleEntries = useMemo(() => {
    if (selectedGroupId === 'all') return activeEntries
    if (selectedGroupId === vault.rootGroupId) return activeEntries.filter((entry) => entry.groupId === vault.rootGroupId)
    if (selectedGroup?.isRecycleBin) return selectedGroupIsRecycleRoot ? vault.entries.filter((entry) => entry.isDeleted) : vault.entries.filter((entry) => entry.groupId === selectedGroupId)
    return activeEntries.filter((entry) => entry.groupId === selectedGroupId)
  }, [activeEntries, selectedGroup, selectedGroupId, selectedGroupIsRecycleRoot, vault.entries, vault.rootGroupId])
  const rootEntryCount = activeEntries.filter((entry) => entry.groupId === vault.rootGroupId).length
  const [selectedEntryId, setSelectedEntryId] = useState(activeEntries[0]?.id ?? '')
  const selectedEntry = visibleEntries.find((entry) => entry.id === selectedEntryId) ?? visibleEntries[0]
  const [choosingType, setChoosingType] = useState(false)
  const [draft, setDraft] = useState<VaultEntryDraft | null>(null)
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(() => new Set())
  const [isLoadingEntry, setIsLoadingEntry] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [entryToDelete, setEntryToDelete] = useState<VaultEntrySummary | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [groupDialog, setGroupDialog] = useState<VaultGroupSummary | 'new' | null>(null)
  const [groupToDelete, setGroupToDelete] = useState<VaultGroupSummary | null>(null)
  const [isSavingGroup, setIsSavingGroup] = useState(false)
  const [groupError, setGroupError] = useState('')

  function resetEntryEditor() {
    setDraft(null)
    setChoosingType(false)
    setVisibleSecrets(new Set())
    setSaveError('')
  }

  function selectGroup(groupId: string) {
    setSelectedGroupId(groupId)
    const group = vault.groups.find((candidate) => candidate.id === groupId)
    const isRecycleRoot = group?.isRecycleBin && group.parentGroupId === vault.rootGroupId
    const firstEntry = groupId === 'all' ? activeEntries[0] : groupId === vault.rootGroupId ? activeEntries.find((entry) => entry.groupId === vault.rootGroupId) : vault.entries.find((entry) => entry.groupId === groupId || (isRecycleRoot && entry.isDeleted))
    setSelectedEntryId(firstEntry?.id ?? '')
    resetEntryEditor()
  }

  function beginCreate() {
    setDraft(null)
    setChoosingType(true)
    setVisibleSecrets(new Set())
    setSaveError('')
  }

  function chooseType(type: VaultEntryDraft['type']) {
    const groupId = selectedGroupId !== 'all' && !selectedGroup?.isRecycleBin ? selectedGroupId : vault.rootGroupId
    setDraft(createEmptyEntryDraft(type, groupId))
    setChoosingType(false)
  }

  async function beginEdit(entry: VaultEntrySummary) {
    setIsLoadingEntry(true)
    setSaveError('')
    try {
      setDraft(await onLoadEntry(entry.id))
      setChoosingType(false)
      setVisibleSecrets(new Set())
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
      resetEntryEditor()
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

  async function saveGroup(group: VaultGroupDraft) {
    setIsSavingGroup(true)
    setGroupError('')
    try {
      const saved = await onSaveGroup(group)
      setSelectedGroupId(saved.groupId)
      setSelectedEntryId('')
      setGroupDialog(null)
    } catch (error) {
      setGroupError(error instanceof Error ? error.message : 'The folder could not be saved safely.')
    } finally {
      setIsSavingGroup(false)
    }
  }

  async function deleteGroup() {
    if (!groupToDelete) return
    setIsSavingGroup(true)
    setGroupError('')
    try {
      await onDeleteGroup(groupToDelete.id)
      setSelectedGroupId('all')
      setSelectedEntryId('')
      setGroupToDelete(null)
      resetEntryEditor()
    } catch (error) {
      setGroupError(error instanceof Error ? error.message : 'The folder could not be deleted safely.')
    } finally {
      setIsSavingGroup(false)
    }
  }

  const definition = draft ? getEntryTypeDefinition(draft.type) : null

  return <div className="vault-browser">
    <header className="vault-browser-header"><div className="vault-browser-title"><p className="eyebrow">KDBX {vault.version}</p><h1>{vault.databaseName}</h1><p>{activeEntries.length} {activeEntries.length === 1 ? 'entry' : 'entries'} · decrypted in memory</p></div><div className="vault-browser-actions"><button className="button button-secondary" onClick={onLock} type="button">Lock vault</button><button className="button button-primary" disabled={!canEdit || isSaving || isDeleting} onClick={beginCreate} title={canEdit ? 'Add entry' : 'Dropbox vaults can be edited; local files remain read only.'} type="button">Add entry</button></div></header>
    {!canEdit && <p className="read-only-note">This device file is open read only. Connect and open its Dropbox copy to add or edit entries.</p>}
    <div className="vault-browser-grid">
      <aside className="group-list" aria-label="Vault folders">
        <div className="panel-heading"><h2>Folders</h2>{canEdit && <button aria-label="Create folder" className="panel-action" onClick={() => { setGroupError(''); setGroupDialog('new') }} type="button">+</button>}</div>
        <button className={selectedGroupId === 'all' ? 'is-selected' : ''} onClick={() => selectGroup('all')} type="button"><span>All entries</span><small>{activeEntries.length}</small></button>
        <button className={selectedGroupId === vault.rootGroupId ? 'is-selected' : ''} onClick={() => selectGroup(vault.rootGroupId)} type="button"><span>No folder</span><small>{rootEntryCount}</small></button>
        {vault.groups.map((group) => <button className={selectedGroupId === group.id ? 'is-selected' : ''} key={group.id} onClick={() => selectGroup(group.id)} style={{ paddingInlineStart: `${12 + group.depth * 12}px` }} title={group.path} type="button"><span>{group.name}</span><small>{group.entryCount}</small></button>)}
        {canEdit && selectedGroup && !selectedGroup.isRecycleBin && <div className="group-actions"><button onClick={() => { setGroupError(''); setGroupDialog(selectedGroup) }} type="button">Rename</button><button className="is-danger" onClick={() => { setGroupError(''); setGroupToDelete(selectedGroup) }} type="button">Delete</button></div>}
      </aside>
      <section className="entry-list" aria-label="Vault entries"><h2>Entries</h2>{visibleEntries.length ? visibleEntries.map((entry) => <button className={selectedEntryId === entry.id ? 'is-selected' : ''} key={entry.id} onClick={() => { setSelectedEntryId(entry.id); resetEntryEditor() }} type="button"><span className="entry-glyph">{getEntryTypeDefinition(entry.type).glyph}</span><span><strong>{entry.title}</strong><small>{entry.subtitle}</small></span></button>) : <p className="vault-empty-state">No entries here.</p>}</section>
      <section className="entry-detail" aria-label="Selected entry">
        {choosingType ? <div className="entry-type-picker"><div className="entry-editor-heading"><div><p className="eyebrow">New entry</p><h2>Choose a type</h2></div></div><p className="type-picker-copy">The type controls which fields appear in the entry.</p><div className="entry-type-grid">{entryTypeDefinitions.map((type) => <button key={type.id} onClick={() => chooseType(type.id)} type="button"><span className="entry-glyph">{type.glyph}</span><span><strong>{type.label}</strong><small>{type.description}</small></span></button>)}</div><button className="text-button" onClick={resetEntryEditor} type="button">Cancel</button></div> : draft && definition ? <form className="entry-editor" onSubmit={saveEntry}>
          <div className="entry-editor-heading"><div><p className="eyebrow">{draft.id ? `Edit ${definition.label}` : `New ${definition.label}`}</p><h2>{draft.id ? draft.title || `Untitled ${definition.label}` : `Add ${definition.label}`}</h2></div>{!draft.id && <button className="text-button" onClick={() => { setDraft(null); setChoosingType(true) }} type="button">Change type</button>}</div>
          <label className="field"><span>Name</span><input autoFocus autoComplete="off" disabled={isSaving} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required value={draft.title} /></label>
          <label className="field"><span>Folder</span><select disabled={isSaving} onChange={(event) => setDraft({ ...draft, groupId: event.target.value })} value={draft.groupId}><option value={vault.rootGroupId}>No folder</option>{vault.groups.filter((group) => !group.isRecycleBin).map((group) => <option key={group.id} value={group.id}>{group.path}</option>)}</select></label>
          {definition.fields.map((field) => <EntryField disabled={isSaving} field={field} key={field.key} onChange={(value) => setDraft({ ...draft, fields: { ...draft.fields, [field.key]: value } })} onToggle={() => setVisibleSecrets((current) => { const next = new Set(current); if (next.has(field.key)) next.delete(field.key); else next.add(field.key); return next })} value={draft.fields[field.key] || ''} visible={visibleSecrets.has(field.key)} />)}
          {saveError && <p className="unlock-error" role="alert">{saveError}</p>}<div className="entry-editor-actions"><button className="button button-secondary" disabled={isSaving} onClick={resetEntryEditor} type="button">Cancel</button><button className="button button-primary" disabled={isSaving} type="submit">{isSaving ? 'Encrypting and saving…' : 'Save entry'}</button></div>
        </form> : selectedEntry ? <><div className="entry-detail-heading"><span className="entry-glyph entry-glyph-large">{getEntryTypeDefinition(selectedEntry.type).glyph}</span><div><p className="eyebrow">{selectedEntry.isDeleted ? 'Recycle Bin' : entryTypeLabel(selectedEntry.type)}</p><h2>{selectedEntry.title}</h2></div></div><dl><div><dt>Type</dt><dd>{entryTypeLabel(selectedEntry.type)}</dd></div><div><dt>Folder</dt><dd>{selectedEntry.groupId === vault.rootGroupId ? 'No folder' : vault.groups.find((group) => group.id === selectedEntry.groupId)?.path || '—'}</dd></div>{selectedEntry.username && <div><dt>Username</dt><dd>{selectedEntry.username}</dd></div>}{selectedEntry.url && <div><dt>Website</dt><dd>{selectedEntry.url}</dd></div>}{selectedEntry.hasPassword && <div><dt>Protected fields</dt><dd className="masked-secret">••••••••••••</dd></div>}</dl>{saveError && <p className="unlock-error" role="alert">{saveError}</p>}{!selectedEntry.isDeleted && canEdit && <div className="entry-detail-actions"><button className="button button-secondary" disabled={isLoadingEntry} onClick={() => void beginEdit(selectedEntry)} type="button">{isLoadingEntry ? 'Preparing…' : 'Edit entry'}</button><button className="text-button text-button-danger" onClick={() => { setDeleteError(''); setEntryToDelete(selectedEntry) }} type="button">Delete entry</button></div>}<p className="read-only-note">Protected values are revealed only inside the editor while this vault is unlocked.</p></> : <p className="vault-empty-state">Choose an entry or add a new one.</p>}
      </section>
    </div>
    {entryToDelete && <DeleteEntryDialog entry={entryToDelete} error={deleteError} isDeleting={isDeleting} onCancel={() => { if (!isDeleting) { setDeleteError(''); setEntryToDelete(null) } }} onDelete={() => void deleteEntry()} />}
    {groupDialog && <GroupNameDialog error={groupError} group={groupDialog === 'new' ? null : groupDialog} isSaving={isSavingGroup} onCancel={() => { if (!isSavingGroup) { setGroupError(''); setGroupDialog(null) } }} onSave={(group) => void saveGroup(group)} rootGroupId={vault.rootGroupId} />}
    {groupToDelete && <DeleteGroupDialog error={groupError} group={groupToDelete} isDeleting={isSavingGroup} onCancel={() => { if (!isSavingGroup) { setGroupError(''); setGroupToDelete(null) } }} onDelete={() => void deleteGroup()} />}
  </div>
}
