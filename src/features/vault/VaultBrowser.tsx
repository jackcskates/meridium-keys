import { useEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { Check, Copy, Ellipsis, FolderInput, LoaderCircle, LockKeyhole, Pencil, Plus, Trash2 } from 'lucide-react'
import { copyProtectedText } from './copyProtectedText'
import { EntryTypeIcon } from './EntryTypeIcon'
import { createEmptyEntryDraft, entryTypeDefinitions, entryTypeLabel, getEntryTypeDefinition, type EntryFieldDefinition } from './entryTypes'
import { generateServicePassword, generatedPasswordLength } from './passwordGenerator'
import type { VaultEntryDetails, VaultEntryDraft, VaultEntrySummary, VaultGroupDraft, VaultGroupSummary, VaultSnapshot } from './types'

type VaultBrowserProps = {
  vault: VaultSnapshot
  canEdit: boolean
  onDeleteEntry: (entryId: string) => Promise<VaultSnapshot>
  onDeleteGroup: (groupId: string) => Promise<VaultSnapshot>
  onLoadEntry: (entryId: string) => Promise<VaultEntryDetails>
  onReadProtectedField: (entryId: string, fieldKey: string) => Promise<string>
  onLock: () => void
  onMoveEntry: (entryId: string, groupId: string) => Promise<{ entryId: string; vault: VaultSnapshot }>
  onSaveEntry: (entry: VaultEntryDraft) => Promise<{ entryId: string; vault: VaultSnapshot }>
  onSaveGroup: (group: VaultGroupDraft) => Promise<{ groupId: string; vault: VaultSnapshot }>
}

const entryDragMime = 'application/x-meridium-vault-entry'

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
    <div className="confirm-dialog-copy"><p className="eyebrow">Delete folder</p><h2 id="delete-group-title">Delete {group.name}?</h2><p id="delete-group-description">This empty folder will move to the standard KDBX Recycle Bin.</p></div>
    {error && <p className="unlock-error" role="alert">{error}</p>}
    <div className="confirm-dialog-actions"><button className="button button-secondary" disabled={isDeleting} onClick={onCancel} type="button">Cancel</button><button className="button button-danger" disabled={isDeleting} onClick={onDelete} type="button">{isDeleting ? 'Deleting…' : `Delete ${group.name}`}</button></div>
  </div></DialogShell>
}

function EntryField({ field, value, disabled, visible, onChange, onToggle, onGenerate }: {
  field: EntryFieldDefinition
  value: string
  disabled: boolean
  visible: boolean
  onChange: (value: string) => void
  onToggle: () => void
  onGenerate?: () => void
}) {
  const isTextarea = field.kind === 'textarea' || field.kind === 'secret-textarea'
  const isSecret = field.kind === 'secret' || field.kind === 'secret-textarea'
  const inputType = field.kind === 'email' ? 'email' : field.kind === 'url' ? 'url' : field.kind === 'date' ? 'date' : isSecret && !visible ? 'password' : 'text'
  return <label className="field"><span>{field.label}</span>{isTextarea ? <div className={`secret-field ${isSecret && !visible ? 'is-masked' : ''}`}><textarea disabled={disabled} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} required={field.required} rows={field.kind === 'secret-textarea' ? 3 : 4} value={value} />{isSecret && <button aria-label={`${visible ? 'Hide' : 'Show'} ${field.label.toLowerCase()}`} disabled={disabled} onClick={onToggle} type="button">{visible ? 'Hide' : 'Show'}</button>}</div> : isSecret ? <div className={`secret-input ${onGenerate ? 'has-generator' : ''}`}><input autoComplete="new-password" disabled={disabled} onChange={(event) => onChange(event.target.value)} required={field.required} type={inputType} value={value} /><span className="secret-input-actions"><button aria-label={`${visible ? 'Hide' : 'Show'} ${field.label.toLowerCase()}`} disabled={disabled} onClick={onToggle} type="button">{visible ? 'Hide' : 'Show'}</button>{onGenerate && <button aria-label={`Generate a secure ${generatedPasswordLength}-character password`} className="password-generate" disabled={disabled} onClick={onGenerate} title={`Generate a secure ${generatedPasswordLength}-character password`} type="button">Generate</button>}</span></div> : <input autoComplete="off" disabled={disabled} inputMode={field.kind === 'email' ? 'email' : field.kind === 'url' ? 'url' : undefined} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} required={field.required} type={inputType} value={value} />}</label>
}

function DragHandle() {
  return <svg aria-hidden="true" fill="currentColor" height="18" viewBox="0 0 18 18" width="18"><circle cx="6" cy="4" r="1.2" /><circle cx="12" cy="4" r="1.2" /><circle cx="6" cy="9" r="1.2" /><circle cx="12" cy="9" r="1.2" /><circle cx="6" cy="14" r="1.2" /><circle cx="12" cy="14" r="1.2" /></svg>
}

function MoveEntryDialog({ entry, vault, isMoving, error, onCancel, onMove }: {
  entry: VaultEntrySummary
  vault: VaultSnapshot
  isMoving: boolean
  error: string
  onCancel: () => void
  onMove: (groupId: string) => void
}) {
  const [groupId, setGroupId] = useState(entry.groupId)
  return <DialogShell labelledBy="move-entry-title" locked={isMoving} onCancel={onCancel}><form className="confirm-dialog-card" onSubmit={(event) => { event.preventDefault(); onMove(groupId) }}>
    <div className="confirm-dialog-copy"><p className="eyebrow">Move entry</p><h2 id="move-entry-title">Move {entry.title}</h2><p>Choose a destination inside this vault.</p></div>
    <label className="field"><span>Folder</span><select autoFocus disabled={isMoving} onChange={(event) => setGroupId(event.target.value)} value={groupId}><option value={vault.rootGroupId}>No folder</option>{vault.groups.filter((group) => !group.isRecycleBin).map((group) => <option key={group.id} value={group.id}>{group.path}</option>)}</select></label>
    {error && <p className="unlock-error" role="alert">{error}</p>}
    <div className="confirm-dialog-actions"><button className="button button-secondary" disabled={isMoving} onClick={onCancel} type="button">Cancel</button><button className="button button-primary" disabled={isMoving || groupId === entry.groupId} type="submit">{isMoving ? 'Moving…' : 'Move entry'}</button></div>
  </form></DialogShell>
}

export function VaultBrowser({ vault, canEdit, onDeleteEntry, onDeleteGroup, onLoadEntry, onLock, onMoveEntry, onReadProtectedField, onSaveEntry, onSaveGroup }: VaultBrowserProps) {
  const activeEntries = useMemo(() => vault.entries.filter((entry) => !entry.isDeleted), [vault.entries])
  const unfiledEntries = useMemo(() => activeEntries.filter((entry) => entry.groupId === vault.rootGroupId), [activeEntries, vault.rootGroupId])
  const activeGroups = useMemo(() => vault.groups.filter((group) => !group.isRecycleBin), [vault.groups])
  const recycleBin = vault.groups.find((group) => group.isRecycleBin && group.parentGroupId === vault.rootGroupId)
  const [selectedGroupId, setSelectedGroupId] = useState(vault.rootGroupId)
  const selectedGroup = vault.groups.find((group) => group.id === selectedGroupId)
  const selectedGroupIsRecycleRoot = selectedGroup?.isRecycleBin && selectedGroup.parentGroupId === vault.rootGroupId
  const visibleEntries = useMemo(() => {
    if (selectedGroupId === vault.rootGroupId) return unfiledEntries
    if (selectedGroup?.isRecycleBin) return selectedGroupIsRecycleRoot ? vault.entries.filter((entry) => entry.isDeleted) : vault.entries.filter((entry) => entry.groupId === selectedGroupId)
    return activeEntries.filter((entry) => entry.groupId === selectedGroupId)
  }, [activeEntries, selectedGroup, selectedGroupId, selectedGroupIsRecycleRoot, unfiledEntries, vault.entries, vault.rootGroupId])
  const [selectedEntryId, setSelectedEntryId] = useState(unfiledEntries[0]?.id ?? '')
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
  const [openGroupMenuId, setOpenGroupMenuId] = useState('')
  const [isSavingGroup, setIsSavingGroup] = useState(false)
  const [groupError, setGroupError] = useState('')
  const [draggedEntryId, setDraggedEntryId] = useState('')
  const [dropTargetGroupId, setDropTargetGroupId] = useState('')
  const [entryToMove, setEntryToMove] = useState<VaultEntrySummary | null>(null)
  const [isMovingEntry, setIsMovingEntry] = useState(false)
  const [moveError, setMoveError] = useState('')
  const [moveStatus, setMoveStatus] = useState('')
  const [copyState, setCopyState] = useState<{ entryId: string; fieldKey: string; status: 'copying' | 'copied' | 'error'; message: string } | null>(null)
  const nativeDragEntryIdRef = useRef('')
  const pointerDragRef = useRef<{ pointerId: number; entryId: string; targetGroupId: string } | null>(null)
  const groupMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!openGroupMenuId) return

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!groupMenuRef.current?.contains(event.target as Node)) setOpenGroupMenuId('')
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenGroupMenuId('')
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [openGroupMenuId])

  useEffect(() => {
    if (copyState?.status !== 'copied') return
    const timeout = window.setTimeout(() => setCopyState(null), 2400)
    return () => window.clearTimeout(timeout)
  }, [copyState])

  function resetEntryEditor() {
    setDraft(null)
    setChoosingType(false)
    setVisibleSecrets(new Set())
    setSaveError('')
  }

  function selectGroup(groupId: string) {
    setOpenGroupMenuId('')
    setSelectedGroupId(groupId)
    const group = vault.groups.find((candidate) => candidate.id === groupId)
    const isRecycleRoot = group?.isRecycleBin && group.parentGroupId === vault.rootGroupId
    const firstEntry = groupId === vault.rootGroupId ? unfiledEntries[0] : vault.entries.find((entry) => entry.groupId === groupId || (isRecycleRoot && entry.isDeleted))
    setSelectedEntryId(firstEntry?.id ?? '')
    resetEntryEditor()
  }

  function selectUnfiledEntry(entryId: string) {
    setSelectedGroupId(vault.rootGroupId)
    setSelectedEntryId(entryId)
    resetEntryEditor()
  }

  function beginCreate() {
    setDraft(null)
    setChoosingType(true)
    setVisibleSecrets(new Set())
    setSaveError('')
  }

  function chooseType(type: VaultEntryDraft['type']) {
    const groupId = !selectedGroup?.isRecycleBin ? selectedGroupId : vault.rootGroupId
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

  async function copyProtectedField(entry: VaultEntrySummary, field: EntryFieldDefinition) {
    setCopyState({ entryId: entry.id, fieldKey: field.key, status: 'copying', message: `Copying ${field.label.toLowerCase()}…` })
    try {
      await copyProtectedText(() => onReadProtectedField(entry.id, field.key))
      setCopyState({ entryId: entry.id, fieldKey: field.key, status: 'copied', message: `${field.label} copied.` })
    } catch (error) {
      setCopyState({
        entryId: entry.id,
        fieldKey: field.key,
        status: 'error',
        message: error instanceof Error ? error.message : `${field.label} could not be copied.`,
      })
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
    if (groupToDelete.entryCount > 0 || activeGroups.some((group) => group.parentGroupId === groupToDelete.id)) {
      setGroupError('Move or delete everything inside this folder before deleting it.')
      setGroupToDelete(null)
      return
    }
    setIsSavingGroup(true)
    setGroupError('')
    try {
      await onDeleteGroup(groupToDelete.id)
      setSelectedGroupId(vault.rootGroupId)
      setSelectedEntryId('')
      setGroupToDelete(null)
      resetEntryEditor()
    } catch (error) {
      setGroupError(error instanceof Error ? error.message : 'The folder could not be deleted safely.')
    } finally {
      setIsSavingGroup(false)
    }
  }

  function folderLabel(groupId: string) {
    return groupId === vault.rootGroupId ? 'outside folders' : vault.groups.find((group) => group.id === groupId)?.name || 'folder'
  }

  function canDropEntry(entryId: string, groupId: string) {
    if (!canEdit || isMovingEntry) return false
    const entry = vault.entries.find((candidate) => candidate.id === entryId)
    const group = groupId === vault.rootGroupId ? null : vault.groups.find((candidate) => candidate.id === groupId)
    return Boolean(entry && !entry.isDeleted && entry.groupId !== groupId && (groupId === vault.rootGroupId || (group && !group.isRecycleBin)))
  }

  function clearDragState() {
    nativeDragEntryIdRef.current = ''
    pointerDragRef.current = null
    setDraggedEntryId('')
    setDropTargetGroupId('')
  }

  async function moveEntry(entryId: string, groupId: string) {
    if (!canDropEntry(entryId, groupId)) {
      clearDragState()
      return
    }
    const entry = vault.entries.find((candidate) => candidate.id === entryId)
    if (!entry) return
    setIsMovingEntry(true)
    setMoveError('')
    setMoveStatus(`Moving ${entry.title} to ${folderLabel(groupId)}…`)
    clearDragState()
    try {
      const moved = await onMoveEntry(entryId, groupId)
      setSelectedGroupId(groupId)
      setSelectedEntryId(moved.entryId)
      setEntryToMove(null)
      resetEntryEditor()
      setMoveStatus(`${entry.title} moved to ${folderLabel(groupId)}.`)
    } catch (error) {
      setMoveError(error instanceof Error ? error.message : 'The entry could not be moved safely.')
      setMoveStatus('')
    } finally {
      setIsMovingEntry(false)
    }
  }

  function beginNativeDrag(event: ReactDragEvent<HTMLButtonElement>, entry: VaultEntrySummary) {
    if (!canEdit || isMovingEntry || entry.isDeleted) {
      event.preventDefault()
      return
    }
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData(entryDragMime, entry.id)
    event.dataTransfer.setData('text/plain', entry.id)
    nativeDragEntryIdRef.current = entry.id
    setDraggedEntryId(entry.id)
    setMoveStatus(`Moving ${entry.title}. Drop it on a folder.`)
  }

  function updatePointerTarget(clientX: number, clientY: number, entryId: string) {
    const element = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-folder-id]')
    const groupId = element?.dataset.folderId || ''
    const targetGroupId = canDropEntry(entryId, groupId) ? groupId : ''
    if (pointerDragRef.current) pointerDragRef.current.targetGroupId = targetGroupId
    setDropTargetGroupId(targetGroupId)
  }

  function beginPointerDrag(event: ReactPointerEvent<HTMLButtonElement>, entry: VaultEntrySummary) {
    if (!canEdit || isMovingEntry || entry.isDeleted || (event.pointerType === 'mouse' && event.button !== 0)) return
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    pointerDragRef.current = { pointerId: event.pointerId, entryId: entry.id, targetGroupId: '' }
    setDraggedEntryId(entry.id)
    setMoveStatus(`Moving ${entry.title}. Drop it on a folder.`)
    updatePointerTarget(event.clientX, event.clientY, entry.id)
  }

  function continuePointerDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = pointerDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    event.preventDefault()
    updatePointerTarget(event.clientX, event.clientY, drag.entryId)
  }

  function finishPointerDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = pointerDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    event.preventDefault()
    const { entryId, targetGroupId } = drag
    clearDragState()
    if (targetGroupId) void moveEntry(entryId, targetGroupId)
    else setMoveStatus('Move canceled. Drop entries on No folder or another folder.')
  }

  function finishNativeDrop(event: ReactDragEvent<HTMLElement>, groupId: string) {
    event.preventDefault()
    const entryId = event.dataTransfer.getData(entryDragMime) || nativeDragEntryIdRef.current || draggedEntryId
    const canMove = canDropEntry(entryId, groupId)
    clearDragState()
    if (canMove) void moveEntry(entryId, groupId)
    else setMoveStatus('Move canceled. Choose No folder or a different folder outside the Recycle Bin.')
  }

  const definition = draft ? getEntryTypeDefinition(draft.type) : null
  const selectedProtectedFields = selectedEntry
    ? getEntryTypeDefinition(selectedEntry.type).fields.filter((field) => selectedEntry.protectedFieldKeys.includes(field.key))
    : []

  return <div className="vault-browser">
    <header className="vault-browser-header"><div className="vault-browser-title"><p className="eyebrow">KDBX {vault.version}</p><h1>{vault.databaseName}</h1><p>{activeEntries.length} {activeEntries.length === 1 ? 'entry' : 'entries'} · decrypted in memory</p></div><div className="vault-browser-actions"><button aria-label="Lock vault" className="button button-secondary button-icon" onClick={onLock} title="Lock vault" type="button"><LockKeyhole aria-hidden="true" /></button><button aria-label="Add entry" className="button button-primary button-icon" disabled={!canEdit || isSaving || isDeleting} onClick={beginCreate} title={canEdit ? 'Add entry' : 'Dropbox vaults can be edited; local files remain read only.'} type="button"><Plus aria-hidden="true" /></button></div></header>
    {!canEdit && <p className="read-only-note">This device file is open read only. Connect and open its Dropbox copy to add or edit entries.</p>}
    <div className="vault-browser-grid">
      <aside className="group-list" aria-label="Vault folders">
        <div className="panel-heading"><h2>Folders</h2>{canEdit && <button aria-label="Create folder" className="panel-action" onClick={() => { setGroupError(''); setGroupDialog('new') }} title="Create folder" type="button"><Plus aria-hidden="true" size={17} /></button>}</div>
        <div className="group-list-scroll">
          <div className="folder-items">
            {activeGroups.map((group) => {
              const isSelected = selectedGroupId === group.id
              const isMenuOpen = openGroupMenuId === group.id
              const hasContents = group.entryCount > 0 || activeGroups.some((candidate) => candidate.parentGroupId === group.id)
              return <div className={`group-nav-item ${isSelected ? 'is-selected' : ''} ${isMenuOpen ? 'is-menu-open' : ''}`} key={group.id} ref={isMenuOpen ? groupMenuRef : undefined}>
                <button
                  className={`group-nav-button ${isSelected ? 'is-selected' : ''} ${dropTargetGroupId === group.id ? 'is-drop-target' : ''}`}
                  data-folder-id={group.id}
                  onClick={() => selectGroup(group.id)}
                  onDragOver={(event) => { const entryId = nativeDragEntryIdRef.current || draggedEntryId; if (canDropEntry(entryId, group.id)) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropTargetGroupId(group.id) } }}
                  onDrop={(event) => finishNativeDrop(event, group.id)}
                  style={{ paddingInlineStart: `${10 + group.depth * 12}px` }}
                  title={group.path}
                  type="button"
                ><span>{group.name}</span><small>{group.entryCount}</small></button>
                {canEdit && <button
                  aria-expanded={isMenuOpen}
                  aria-haspopup="menu"
                  aria-label={`Folder actions for ${group.name}`}
                  className="group-menu-trigger"
                  onClick={() => setOpenGroupMenuId(isMenuOpen ? '' : group.id)}
                  title={`Folder actions for ${group.name}`}
                  type="button"
                ><Ellipsis aria-hidden="true" size={18} /></button>}
                {isMenuOpen && <div aria-label={`${group.name} folder actions`} className="group-overflow-menu" role="menu">
                  <button onClick={() => { setOpenGroupMenuId(''); setGroupError(''); setGroupDialog(group) }} role="menuitem" type="button"><Pencil aria-hidden="true" size={16} />Rename</button>
                  <button aria-label={hasContents ? `Delete ${group.name}, unavailable because the folder is not empty` : `Delete ${group.name}`} className="is-danger" disabled={hasContents} onClick={() => { setOpenGroupMenuId(''); setGroupError(''); setGroupToDelete(group) }} role="menuitem" title={hasContents ? 'Move or delete everything inside this folder first.' : `Delete ${group.name}`} type="button"><Trash2 aria-hidden="true" size={16} />Delete</button>
                </div>}
              </div>
            })}
          </div>
          <div
            aria-label="Entries not in a folder"
            className={`unfiled-entry-list ${dropTargetGroupId === vault.rootGroupId ? 'is-drop-target' : ''}`}
            data-folder-id={vault.rootGroupId}
            onDragOver={(event) => { const entryId = nativeDragEntryIdRef.current || draggedEntryId; if (canDropEntry(entryId, vault.rootGroupId)) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropTargetGroupId(vault.rootGroupId) } }}
            onDrop={(event) => finishNativeDrop(event, vault.rootGroupId)}
          >
            {unfiledEntries.map((entry) => <button
              className={selectedGroupId === vault.rootGroupId && selectedEntryId === entry.id ? 'is-selected' : ''}
              key={entry.id}
              onClick={() => selectUnfiledEntry(entry.id)}
              type="button"
            ><span className="unfiled-entry-mark"><EntryTypeIcon type={entry.type} /></span><span>{entry.title}</span></button>)}
            {!unfiledEntries.length && <p>{draggedEntryId ? 'Drop here to remove from folder' : 'No entries outside folders'}</p>}
          </div>
        </div>
        {recycleBin && <div className="recycle-bin-dock"><button
          className={`group-nav-button ${selectedGroupId === recycleBin.id ? 'is-selected' : ''}`}
          onClick={() => selectGroup(recycleBin.id)}
          title={recycleBin.path}
          type="button"
        ><span>Recycle Bin</span><small>{recycleBin.entryCount}</small></button></div>}
      </aside>
      <section className="entry-list" aria-label="Vault entries">
        <h2>Entries</h2>
        {canEdit && activeEntries.length > 0 && <p aria-live="polite" className="entry-move-hint">{moveStatus || 'Drag an entry onto a folder to move it.'}</p>}
        {visibleEntries.length ? visibleEntries.map((entry) => <div
          className={`entry-row ${selectedEntryId === entry.id ? 'is-selected' : ''} ${draggedEntryId === entry.id ? 'is-dragging' : ''}`}
          key={entry.id}
        >
          <button
            className="entry-row-open"
            draggable={canEdit && !entry.isDeleted && !isMovingEntry}
            onClick={() => { setSelectedEntryId(entry.id); resetEntryEditor() }}
            onDragEnd={() => { const wasActive = Boolean(nativeDragEntryIdRef.current); clearDragState(); if (wasActive && !isMovingEntry) setMoveStatus('Move canceled. Drop entries on No folder or another folder.') }}
            onDragStart={(event) => beginNativeDrag(event, entry)}
            type="button"
          ><span className="entry-glyph"><EntryTypeIcon type={entry.type} /></span><span><strong>{entry.title}</strong><small>{entry.subtitle}</small></span></button>
          {canEdit && !entry.isDeleted && <button
            aria-label={`Drag ${entry.title} to a folder`}
            className="entry-drag-handle"
            disabled={isMovingEntry}
            onPointerCancel={finishPointerDrag}
            onPointerDown={(event) => beginPointerDrag(event, entry)}
            onPointerMove={continuePointerDrag}
            onPointerUp={finishPointerDrag}
            title={`Drag ${entry.title} to a folder`}
            type="button"
          ><DragHandle /></button>}
        </div>) : <p className="vault-empty-state">No entries here.</p>}
      </section>
      <section className="entry-detail" aria-label="Selected entry">
        {choosingType ? <div className="entry-type-picker"><div className="entry-editor-heading"><div><p className="eyebrow">New entry</p><h2>Choose a type</h2></div></div><p className="type-picker-copy">The type controls which fields appear in the entry.</p><div className="entry-type-grid">{entryTypeDefinitions.map((type) => <button key={type.id} onClick={() => chooseType(type.id)} type="button"><span className="entry-glyph"><EntryTypeIcon type={type.id} /></span><span><strong>{type.label}</strong><small>{type.description}</small></span></button>)}</div><button className="text-button" onClick={resetEntryEditor} type="button">Cancel</button></div> : draft && definition ? <form className="entry-editor" onSubmit={saveEntry}>
          <div className="entry-editor-heading"><div><p className="eyebrow">{draft.id ? `Edit ${definition.label}` : `New ${definition.label}`}</p><h2>{draft.id ? draft.title || `Untitled ${definition.label}` : `Add ${definition.label}`}</h2></div>{!draft.id && <button className="text-button" onClick={() => { setDraft(null); setChoosingType(true) }} type="button">Change type</button>}</div>
          <label className="field"><span>Name</span><input autoFocus autoComplete="off" disabled={isSaving} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required value={draft.title} /></label>
          <label className="field"><span>Folder</span><select disabled={isSaving} onChange={(event) => setDraft({ ...draft, groupId: event.target.value })} value={draft.groupId}><option value={vault.rootGroupId}>No folder</option>{vault.groups.filter((group) => !group.isRecycleBin).map((group) => <option key={group.id} value={group.id}>{group.path}</option>)}</select></label>
          {definition.fields.map((field) => <EntryField disabled={isSaving} field={field} key={field.key} onChange={(value) => setDraft({ ...draft, fields: { ...draft.fields, [field.key]: value } })} onGenerate={field.key === 'password' ? () => setDraft({ ...draft, fields: { ...draft.fields, [field.key]: generateServicePassword() } }) : undefined} onToggle={() => setVisibleSecrets((current) => { const next = new Set(current); if (next.has(field.key)) next.delete(field.key); else next.add(field.key); return next })} value={draft.fields[field.key] || ''} visible={visibleSecrets.has(field.key)} />)}
          {saveError && <p className="unlock-error" role="alert">{saveError}</p>}<div className="entry-editor-actions"><button className="button button-secondary" disabled={isSaving} onClick={resetEntryEditor} type="button">Cancel</button><button className="button button-primary" disabled={isSaving} type="submit">{isSaving ? 'Encrypting and saving…' : 'Save entry'}</button></div>
        </form> : selectedEntry ? <><div className="entry-detail-heading"><span className="entry-glyph entry-glyph-large"><EntryTypeIcon size={21} type={selectedEntry.type} /></span><div><p className="eyebrow">{selectedEntry.isDeleted ? 'Recycle Bin' : entryTypeLabel(selectedEntry.type)}</p><h2>{selectedEntry.title}</h2></div></div><dl><div><dt>Type</dt><dd>{entryTypeLabel(selectedEntry.type)}</dd></div><div><dt>Folder</dt><dd>{selectedEntry.groupId === vault.rootGroupId ? 'No folder' : vault.groups.find((group) => group.id === selectedEntry.groupId)?.path || '—'}</dd></div>{selectedEntry.username && <div><dt>Username</dt><dd>{selectedEntry.username}</dd></div>}{selectedEntry.url && <div><dt>Website</dt><dd>{selectedEntry.url}</dd></div>}{selectedProtectedFields.map((field) => {
          const isCurrent = copyState?.entryId === selectedEntry.id && copyState.fieldKey === field.key
          const isCopying = isCurrent && copyState.status === 'copying'
          const isCopied = isCurrent && copyState.status === 'copied'
          return <div className="protected-detail-row" key={field.key}><dt>{field.label}</dt><dd><span aria-label={`${field.label} hidden`} className="masked-secret">••••••••••••</span><button aria-label={`Copy ${field.label.toLowerCase()}`} aria-busy={isCopying || undefined} className={`protected-copy-button ${isCopied ? 'is-copied' : ''}`} disabled={isCopying} onClick={() => void copyProtectedField(selectedEntry, field)} title={isCopied ? `${field.label} copied` : `Copy ${field.label.toLowerCase()}`} type="button">{isCopying ? <LoaderCircle aria-hidden="true" className="is-spinning" size={17} /> : isCopied ? <Check aria-hidden="true" size={17} /> : <Copy aria-hidden="true" size={17} />}</button></dd></div>
        })}</dl>{copyState?.entryId === selectedEntry.id && <p aria-live="polite" className={`copy-status ${copyState.status === 'error' ? 'is-error' : ''}`} role={copyState.status === 'error' ? 'alert' : 'status'}>{copyState.message}</p>}{saveError && <p className="unlock-error" role="alert">{saveError}</p>}{moveError && <p className="unlock-error" role="alert">{moveError}</p>}{!selectedEntry.isDeleted && canEdit && <div aria-label="Entry actions" className="entry-detail-actions" role="group"><button aria-label={`Edit ${selectedEntry.title}`} aria-busy={isLoadingEntry || undefined} className="button button-secondary button-icon" disabled={isLoadingEntry || isMovingEntry} onClick={() => void beginEdit(selectedEntry)} title={`Edit ${selectedEntry.title}`} type="button">{isLoadingEntry ? <LoaderCircle aria-hidden="true" className="is-spinning" /> : <Pencil aria-hidden="true" />}</button><button aria-label={`Move ${selectedEntry.title}`} className="button button-secondary button-icon" disabled={isMovingEntry || (selectedEntry.groupId === vault.rootGroupId && vault.groups.every((group) => group.isRecycleBin))} onClick={() => { setMoveError(''); setEntryToMove(selectedEntry) }} title={`Move ${selectedEntry.title}`} type="button"><FolderInput aria-hidden="true" /></button><button aria-label={`Delete ${selectedEntry.title}`} className="button button-icon button-icon-danger" disabled={isMovingEntry} onClick={() => { setDeleteError(''); setEntryToDelete(selectedEntry) }} title={`Delete ${selectedEntry.title}`} type="button"><Trash2 aria-hidden="true" /></button></div>}<p className="read-only-note">Protected values stay masked and are decrypted one at a time only when you copy or edit them.</p></> : <p className="vault-empty-state">Choose an entry or add a new one.</p>}
      </section>
    </div>
    {entryToDelete && <DeleteEntryDialog entry={entryToDelete} error={deleteError} isDeleting={isDeleting} onCancel={() => { if (!isDeleting) { setDeleteError(''); setEntryToDelete(null) } }} onDelete={() => void deleteEntry()} />}
    {entryToMove && <MoveEntryDialog entry={entryToMove} error={moveError} isMoving={isMovingEntry} onCancel={() => { if (!isMovingEntry) { setMoveError(''); setEntryToMove(null) } }} onMove={(groupId) => void moveEntry(entryToMove.id, groupId)} vault={vault} />}
    {groupDialog && <GroupNameDialog error={groupError} group={groupDialog === 'new' ? null : groupDialog} isSaving={isSavingGroup} onCancel={() => { if (!isSavingGroup) { setGroupError(''); setGroupDialog(null) } }} onSave={(group) => void saveGroup(group)} rootGroupId={vault.rootGroupId} />}
    {groupToDelete && <DeleteGroupDialog error={groupError} group={groupToDelete} isDeleting={isSavingGroup} onCancel={() => { if (!isSavingGroup) { setGroupError(''); setGroupToDelete(null) } }} onDelete={() => void deleteGroup()} />}
  </div>
}
