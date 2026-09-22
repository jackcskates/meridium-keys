import { useEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { Check, CheckSquare, Copy, Ellipsis, Eye, EyeOff, FolderInput, ListChecks, LoaderCircle, LockKeyhole, Pencil, Plus, Square, Tags, Trash2, X } from 'lucide-react'
import { clampVaultColumnWidths, columnResizeHandleWidth, detailColumnMinWidth, entryColumnMinWidth, folderColumnMinWidth, type ColumnWidths } from './columnSizing'
import { copyProtectedText } from './copyProtectedText'
import { EntryTypeIcon } from './EntryTypeIcon'
import { changeEntryDraftType, createEmptyEntryDraft, entryTypeConflicts, entryTypeDefinitions, entryTypeLabel, getEntryTypeDefinition, missingRequiredEntryFields, type EntryFieldDefinition } from './entryTypes'
import { generateServicePassword, generatedPasswordLength } from './passwordGenerator'
import type { VaultEntryDetails, VaultEntryDraft, VaultEntrySummary, VaultEntryType, VaultGroupDraft, VaultGroupSummary, VaultSnapshot } from './types'

type VaultBrowserProps = {
  vault: VaultSnapshot
  canEdit: boolean
  onChangeEntriesType: (entryIds: string[], entryType: VaultEntryType) => Promise<VaultSnapshot>
  onDeleteEntry: (entryId: string) => Promise<VaultSnapshot>
  onDeleteEntriesForever: (entryIds: string[]) => Promise<VaultSnapshot>
  onDeleteGroup: (groupId: string) => Promise<VaultSnapshot>
  onLoadEntry: (entryId: string) => Promise<VaultEntryDetails>
  onReadProtectedField: (entryId: string, fieldKey: string) => Promise<string>
  onLock: () => void
  onMoveEntry: (entryId: string, groupId: string) => Promise<{ entryId: string; vault: VaultSnapshot }>
  onRenameVault: (name: string) => Promise<VaultSnapshot>
  onSaveEntry: (entry: VaultEntryDraft) => Promise<{ entryId: string; vault: VaultSnapshot }>
  onSaveGroup: (group: VaultGroupDraft) => Promise<{ groupId: string; vault: VaultSnapshot }>
}

const entryDragMime = 'application/x-meridium-vault-entry'
const columnWidthStorageKey = 'meridium-keys-vault-column-widths'

type ResizedColumn = 'folders' | 'entries'

function loadColumnWidths(): ColumnWidths | null {
  try {
    const stored = JSON.parse(localStorage.getItem(columnWidthStorageKey) || 'null') as Partial<ColumnWidths> | null
    if (!stored || typeof stored.folders !== 'number' || typeof stored.entries !== 'number') return null
    if (!Number.isFinite(stored.folders) || !Number.isFinite(stored.entries)) return null
    return {
      folders: Math.max(folderColumnMinWidth, stored.folders),
      entries: Math.max(entryColumnMinWidth, stored.entries),
    }
  } catch {
    return null
  }
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

function DeleteEntriesForeverDialog({ entries, isDeleting, error, onCancel, onDelete }: {
  entries: VaultEntrySummary[]
  isDeleting: boolean
  error: string
  onCancel: () => void
  onDelete: () => void
}) {
  const count = entries.length
  return <DialogShell describedBy="delete-entries-forever-description" labelledBy="delete-entries-forever-title" locked={isDeleting} onCancel={onCancel}><div className="confirm-dialog-card">
    <span className="confirm-dialog-icon"><Trash2 aria-hidden="true" size={24} /></span>
    <div className="confirm-dialog-copy"><p className="eyebrow">Permanent deletion</p><h2 id="delete-entries-forever-title">Delete {count} {count === 1 ? 'entry' : 'entries'} forever?</h2><p id="delete-entries-forever-description">This bypasses the KDBX Recycle Bin and cannot be undone in Keys. Dropbox file history may retain an older encrypted vault version for a limited time.</p></div>
    {error && <p className="unlock-error" role="alert">{error}</p>}
    <div className="confirm-dialog-actions"><button className="button button-secondary" disabled={isDeleting} onClick={onCancel} type="button">Cancel</button><button className="button button-danger" disabled={isDeleting} onClick={onDelete} type="button">{isDeleting ? 'Deleting forever…' : `Delete ${count} forever`}</button></div>
  </div></DialogShell>
}

function ChangeEntriesTypeDialog({ entries, isSaving, error, onCancel, onSave }: {
  entries: VaultEntrySummary[]
  isSaving: boolean
  error: string
  onCancel: () => void
  onSave: (type: VaultEntryType) => void
}) {
  const commonType = entries.every((entry) => entry.type === entries[0]?.type) ? entries[0]?.type : undefined
  const [type, setType] = useState<VaultEntryType>(commonType === 'login' ? 'password' : entryTypeDefinitions.find((definition) => definition.id !== commonType)?.id || 'login')
  const count = entries.length
  return <DialogShell describedBy="change-entry-type-description" labelledBy="change-entry-type-title" locked={isSaving} onCancel={onCancel}><form className="confirm-dialog-card" onSubmit={(event) => { event.preventDefault(); onSave(type) }}>
    <span className="confirm-dialog-icon is-neutral"><Tags aria-hidden="true" size={24} /></span>
    <div className="confirm-dialog-copy"><p className="eyebrow">Entry format</p><h2 id="change-entry-type-title">Change {count} {count === 1 ? 'entry' : 'entries'}?</h2><p id="change-entry-type-description">Shared values move into the new format. Other existing KDBX fields remain preserved if you switch the format back later.</p></div>
    <label className="field"><span>New entry type</span><select autoFocus disabled={isSaving} onChange={(event) => setType(event.target.value as VaultEntryType)} value={type}>{entryTypeDefinitions.map((definition) => <option key={definition.id} value={definition.id}>{definition.label}</option>)}</select></label>
    {error && <p className="unlock-error" role="alert">{error}</p>}
    <div className="confirm-dialog-actions"><button className="button button-secondary" disabled={isSaving} onClick={onCancel} type="button">Cancel</button><button className="button button-primary" disabled={isSaving || entries.every((entry) => entry.type === type)} type="submit">{isSaving ? 'Changing…' : `Change to ${entryTypeLabel(type)}`}</button></div>
  </form></DialogShell>
}

function ChangeEntryTypeDialog({ entry, isSaving, error, onCancel, onSave }: {
  entry: VaultEntryDetails
  isSaving: boolean
  error: string
  onCancel: () => void
  onSave: (draft: VaultEntryDraft) => void
}) {
  const [targetType, setTargetType] = useState<VaultEntryType>(entry.type === 'login' ? 'password' : entryTypeDefinitions.find((definition) => definition.id !== entry.type)?.id || 'login')
  const [step, setStep] = useState<'choose' | 'resolve'>('choose')
  const [draft, setDraft] = useState(() => changeEntryDraftType(entry, targetType))
  const [removedFieldKeys, setRemovedFieldKeys] = useState<Set<string>>(() => new Set())
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(() => new Set())
  const [requiredFieldKeys, setRequiredFieldKeys] = useState<string[]>([])
  const conflicts = entryTypeConflicts(entry, targetType)
  const missingRequired = missingRequiredEntryFields(draft)
  const requiredFields = requiredFieldKeys.flatMap((fieldKey) => {
    const field = getEntryTypeDefinition(targetType).fields.find((candidate) => candidate.key === fieldKey)
    return field ? [field] : []
  })

  function selectType(type: VaultEntryType) {
    setTargetType(type)
    setDraft(changeEntryDraftType(entry, type))
    setRemovedFieldKeys(new Set())
    setVisibleSecrets(new Set())
    setRequiredFieldKeys([])
  }

  function continueChange() {
    if (conflicts.length || missingRequired.length) {
      setRequiredFieldKeys(missingRequired.map((field) => field.key))
      setStep('resolve')
      return
    }
    onSave({ ...draft, removedFieldKeys: [] })
  }

  return <DialogShell describedBy="single-entry-type-description" labelledBy="single-entry-type-title" locked={isSaving} onCancel={onCancel}><div className="confirm-dialog-card entry-type-change-dialog">
    <span className="confirm-dialog-icon is-neutral"><EntryTypeIcon size={22} type={targetType} /></span>
    {step === 'choose' ? <>
      <div className="confirm-dialog-copy"><p className="eyebrow">{entryTypeLabel(entry.type)} entry</p><h2 id="single-entry-type-title">Change {entry.title}’s type</h2><p id="single-entry-type-description">Choose the format that should control this entry’s fields and icon.</p></div>
      <label className="field"><span>New entry type</span><select autoFocus disabled={isSaving} onChange={(event) => selectType(event.target.value as VaultEntryType)} value={targetType}>{entryTypeDefinitions.map((definition) => <option disabled={definition.id === entry.type} key={definition.id} value={definition.id}>{definition.label}</option>)}</select></label>
      {error && <p className="unlock-error" role="alert">{error}</p>}
      <div className="confirm-dialog-actions"><button className="button button-secondary" disabled={isSaving} onClick={onCancel} type="button">Cancel</button><button className="button button-primary" disabled={isSaving || targetType === entry.type} onClick={continueChange} type="button">{conflicts.length || missingRequired.length ? 'Review fields' : `Change to ${entryTypeLabel(targetType)}`}</button></div>
    </> : <>
      <div className="confirm-dialog-copy"><p className="eyebrow">Resolve fields</p><h2 id="single-entry-type-title">Finish changing to {entryTypeLabel(targetType)}</h2><p id="single-entry-type-description">Decide what happens to fields the new format does not show, and complete anything it requires.</p></div>
      {conflicts.length > 0 && <div className="type-conflict-list"><strong>Fields outside {entryTypeLabel(targetType)}</strong>{conflicts.map(({ field, value }) => {
        const isSecret = field.kind === 'secret' || field.kind === 'secret-textarea'
        return <div className="type-conflict-row" key={field.key}><span><strong>{field.label}</strong><small>{isSecret ? 'Protected value' : value}</small></span><label><span className="visually-hidden">Resolution for {field.label}</span><select disabled={isSaving} onChange={(event) => setRemovedFieldKeys((current) => { const next = new Set(current); if (event.target.value === 'remove') next.add(field.key); else next.delete(field.key); return next })} value={removedFieldKeys.has(field.key) ? 'remove' : 'preserve'}><option value="preserve">Preserve in KDBX</option><option value="remove">Remove field</option></select></label></div>
      })}</div>}
      {requiredFields.length > 0 && <div className="type-required-fields"><strong>Required for {entryTypeLabel(targetType)}</strong>{requiredFields.map((field) => <EntryField disabled={isSaving} field={field} key={field.key} onChange={(value) => setDraft((current) => ({ ...current, fields: { ...current.fields, [field.key]: value } }))} onGenerate={field.key === 'password' ? () => setDraft((current) => ({ ...current, fields: { ...current.fields, [field.key]: generateServicePassword() } })) : undefined} onToggle={() => setVisibleSecrets((current) => { const next = new Set(current); if (next.has(field.key)) next.delete(field.key); else next.add(field.key); return next })} value={draft.fields[field.key] || ''} visible={visibleSecrets.has(field.key)} />)}</div>}
      {error && <p className="unlock-error" role="alert">{error}</p>}
      <div className="confirm-dialog-actions"><button className="button button-secondary" disabled={isSaving} onClick={() => setStep('choose')} type="button">Back</button><button className="button button-primary" disabled={isSaving || missingRequiredEntryFields(draft).length > 0} onClick={() => onSave({ ...draft, removedFieldKeys: [...removedFieldKeys] })} type="button">{isSaving ? 'Changing…' : `Change to ${entryTypeLabel(targetType)}`}</button></div>
    </>}
  </div></DialogShell>
}

function RenameVaultDialog({ currentName, isSaving, error, onCancel, onSave }: {
  currentName: string
  isSaving: boolean
  error: string
  onCancel: () => void
  onSave: (name: string) => void
}) {
  const [name, setName] = useState(currentName)
  return <DialogShell labelledBy="rename-vault-title" locked={isSaving} onCancel={onCancel}><form className="confirm-dialog-card" onSubmit={(event) => { event.preventDefault(); onSave(name) }}>
    <div className="confirm-dialog-copy"><p className="eyebrow">Vault settings</p><h2 id="rename-vault-title">Rename vault</h2><p>This changes both the name inside the KDBX database and its encrypted Dropbox filename.</p></div>
    <label className="field"><span>Vault name</span><input autoFocus autoComplete="off" disabled={isSaving} maxLength={80} onChange={(event) => setName(event.target.value)} required value={name} /></label>
    {error && <p className="unlock-error" role="alert">{error}</p>}
    <div className="confirm-dialog-actions"><button className="button button-secondary" disabled={isSaving} onClick={onCancel} type="button">Cancel</button><button className="button button-primary" disabled={isSaving || !name.trim() || (name.trim() === currentName && !error)} type="submit">{isSaving ? 'Renaming…' : 'Rename vault'}</button></div>
  </form></DialogShell>
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
  return <label className="field"><span>{field.label}</span>{isTextarea ? <div className={`secret-field ${isSecret && !visible ? 'is-masked' : ''}`}><textarea autoComplete="off" disabled={disabled} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} required={field.required} rows={field.kind === 'secret-textarea' ? 3 : 4} value={value} />{isSecret && <button aria-label={`${visible ? 'Hide' : 'Show'} ${field.label.toLowerCase()}`} disabled={disabled} onClick={onToggle} type="button">{visible ? 'Hide' : 'Show'}</button>}</div> : isSecret ? <div className={`secret-input ${onGenerate ? 'has-generator' : ''}`}><input autoComplete="off" disabled={disabled} onChange={(event) => onChange(event.target.value)} required={field.required} type={inputType} value={value} /><span className="secret-input-actions"><button aria-label={`${visible ? 'Hide' : 'Show'} ${field.label.toLowerCase()}`} disabled={disabled} onClick={onToggle} type="button">{visible ? 'Hide' : 'Show'}</button>{onGenerate && <button aria-label={`Generate a secure ${generatedPasswordLength}-character password`} className="password-generate" disabled={disabled} onClick={onGenerate} title={`Generate a secure ${generatedPasswordLength}-character password`} type="button">Generate</button>}</span></div> : <input autoComplete="off" disabled={disabled} inputMode={field.kind === 'email' ? 'email' : field.kind === 'url' ? 'url' : undefined} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} required={field.required} type={inputType} value={value} />}</label>
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

export function VaultBrowser({ vault, canEdit, onChangeEntriesType, onDeleteEntry, onDeleteEntriesForever, onDeleteGroup, onLoadEntry, onLock, onMoveEntry, onReadProtectedField, onRenameVault, onSaveEntry, onSaveGroup }: VaultBrowserProps) {
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
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(() => new Set())
  const selectedVisibleEntryIds = useMemo(() => {
    const visibleIds = new Set(visibleEntries.map((entry) => entry.id))
    return new Set([...selectedEntryIds].filter((entryId) => visibleIds.has(entryId)))
  }, [selectedEntryIds, visibleEntries])
  const [entriesToDeleteForever, setEntriesToDeleteForever] = useState<VaultEntrySummary[]>([])
  const [entriesToRetype, setEntriesToRetype] = useState<VaultEntrySummary[]>([])
  const [entryToRetype, setEntryToRetype] = useState<VaultEntryDetails | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isChangingType, setIsChangingType] = useState(false)
  const [isLoadingTypeChange, setIsLoadingTypeChange] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [typeChangeError, setTypeChangeError] = useState('')
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameError, setRenameError] = useState('')
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
  const [revealState, setRevealState] = useState<{ entryId: string; fieldKey: string; status: 'loading' | 'revealed' | 'error'; value: string; message: string } | null>(null)
  const revealRequestIdRef = useRef(0)
  const nativeDragEntryIdRef = useRef('')
  const pointerDragRef = useRef<{ pointerId: number; entryId: string; targetGroupId: string } | null>(null)
  const [columnWidths, setColumnWidths] = useState<ColumnWidths | null>(loadColumnWidths)
  const columnResizeRef = useRef<{ pointerId: number; column: ResizedColumn; startX: number; startWidths: ColumnWidths } | null>(null)
  const vaultGridRef = useRef<HTMLDivElement>(null)
  const folderColumnRef = useRef<HTMLElement>(null)
  const entryColumnRef = useRef<HTMLElement>(null)
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

  useEffect(() => {
    if (!columnWidths) return
    localStorage.setItem(columnWidthStorageKey, JSON.stringify(columnWidths))
  }, [columnWidths])

  useEffect(() => {
    const grid = vaultGridRef.current
    if (!grid || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      setColumnWidths((current) => current ? clampColumnWidths(current, grid.getBoundingClientRect().width) : current)
    })
    observer.observe(grid)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (revealState?.status !== 'revealed') return
    const timeout = window.setTimeout(() => {
      revealRequestIdRef.current += 1
      setRevealState(null)
    }, 15_000)
    return () => window.clearTimeout(timeout)
  }, [revealState])

  useEffect(() => {
    const hideRevealedValue = () => {
      revealRequestIdRef.current += 1
      setRevealState(null)
    }
    const hideWhenBackgrounded = () => {
      if (document.visibilityState === 'hidden') hideRevealedValue()
    }
    window.addEventListener('blur', hideRevealedValue)
    document.addEventListener('visibilitychange', hideWhenBackgrounded)
    return () => {
      window.removeEventListener('blur', hideRevealedValue)
      document.removeEventListener('visibilitychange', hideWhenBackgrounded)
    }
  }, [])

  function hideRevealedField() {
    revealRequestIdRef.current += 1
    setRevealState(null)
  }

  function currentColumnWidths() {
    return {
      folders: folderColumnRef.current?.getBoundingClientRect().width || folderColumnMinWidth,
      entries: entryColumnRef.current?.getBoundingClientRect().width || entryColumnMinWidth,
    }
  }

  function clampColumnWidths(widths: ColumnWidths, gridWidth = vaultGridRef.current?.getBoundingClientRect().width || 0): ColumnWidths {
    return clampVaultColumnWidths(widths, gridWidth)
  }

  function beginColumnResize(event: ReactPointerEvent<HTMLDivElement>, column: ResizedColumn) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    columnResizeRef.current = { pointerId: event.pointerId, column, startX: event.clientX, startWidths: currentColumnWidths() }
    event.currentTarget.dataset.resizing = 'true'
  }

  function continueColumnResize(event: ReactPointerEvent<HTMLDivElement>) {
    const resize = columnResizeRef.current
    if (!resize || resize.pointerId !== event.pointerId) return
    event.preventDefault()
    const delta = event.clientX - resize.startX
    const next = resize.column === 'folders'
      ? { ...resize.startWidths, folders: resize.startWidths.folders + delta }
      : { ...resize.startWidths, entries: resize.startWidths.entries + delta }
    setColumnWidths(clampColumnWidths(next))
  }

  function finishColumnResize(event: ReactPointerEvent<HTMLDivElement>) {
    const resize = columnResizeRef.current
    if (!resize || resize.pointerId !== event.pointerId) return
    columnResizeRef.current = null
    delete event.currentTarget.dataset.resizing
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  function resizeColumnWithKeyboard(event: ReactKeyboardEvent<HTMLDivElement>, column: ResizedColumn) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const direction = event.key === 'ArrowRight' ? 1 : -1
    const step = event.shiftKey ? 32 : 12
    const current = columnWidths || currentColumnWidths()
    const next = column === 'folders'
      ? { ...current, folders: current.folders + direction * step }
      : { ...current, entries: current.entries + direction * step }
    setColumnWidths(clampColumnWidths(next))
  }

  function resetColumnWidths() {
    localStorage.removeItem(columnWidthStorageKey)
    setColumnWidths(null)
  }

  function resetEntryEditor() {
    setDraft(null)
    setChoosingType(false)
    setVisibleSecrets(new Set())
    setSaveError('')
    hideRevealedField()
  }

  function selectGroup(groupId: string) {
    setOpenGroupMenuId('')
    setSelectedGroupId(groupId)
    const group = vault.groups.find((candidate) => candidate.id === groupId)
    const isRecycleRoot = group?.isRecycleBin && group.parentGroupId === vault.rootGroupId
    const firstEntry = groupId === vault.rootGroupId ? unfiledEntries[0] : vault.entries.find((entry) => entry.groupId === groupId || (isRecycleRoot && entry.isDeleted))
    setSelectedEntryId(firstEntry?.id ?? '')
    setSelectionMode(false)
    setSelectedEntryIds(new Set())
    resetEntryEditor()
  }

  function selectUnfiledEntry(entryId: string) {
    setSelectedGroupId(vault.rootGroupId)
    setSelectedEntryId(entryId)
    resetEntryEditor()
  }

  function beginCreate() {
    hideRevealedField()
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
    hideRevealedField()
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

  async function toggleProtectedFieldReveal(entry: VaultEntrySummary, field: EntryFieldDefinition) {
    const isCurrent = revealState?.entryId === entry.id && revealState.fieldKey === field.key
    if (isCurrent && revealState.status !== 'error') {
      hideRevealedField()
      return
    }

    const requestId = revealRequestIdRef.current + 1
    revealRequestIdRef.current = requestId
    setRevealState({ entryId: entry.id, fieldKey: field.key, status: 'loading', value: '', message: `Revealing ${field.label.toLowerCase()}…` })
    try {
      const value = await onReadProtectedField(entry.id, field.key)
      if (revealRequestIdRef.current !== requestId) return
      setRevealState({ entryId: entry.id, fieldKey: field.key, status: 'revealed', value, message: `${field.label} revealed for 15 seconds.` })
    } catch (error) {
      if (revealRequestIdRef.current !== requestId) return
      setRevealState({
        entryId: entry.id,
        fieldKey: field.key,
        status: 'error',
        value: '',
        message: error instanceof Error ? error.message : `${field.label} could not be revealed.`,
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

  function toggleEntrySelection(entryId: string) {
    setSelectedEntryIds((current) => {
      const next = new Set(current)
      if (next.has(entryId)) next.delete(entryId)
      else next.add(entryId)
      return next
    })
  }

  function stopSelecting() {
    setSelectionMode(false)
    setSelectedEntryIds(new Set())
    setDeleteError('')
  }

  async function deleteEntriesForever() {
    if (!entriesToDeleteForever.length) return
    setIsDeleting(true)
    setDeleteError('')
    try {
      await onDeleteEntriesForever(entriesToDeleteForever.map((entry) => entry.id))
      setSelectedEntryId('')
      setEntriesToDeleteForever([])
      stopSelecting()
      resetEntryEditor()
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'The selected entries could not be deleted safely.')
    } finally {
      setIsDeleting(false)
    }
  }

  async function changeEntriesType(type: VaultEntryType) {
    if (!entriesToRetype.length) return
    setIsChangingType(true)
    setTypeChangeError('')
    try {
      await onChangeEntriesType(entriesToRetype.map((entry) => entry.id), type)
      setEntriesToRetype([])
      stopSelecting()
      resetEntryEditor()
    } catch (error) {
      setTypeChangeError(error instanceof Error ? error.message : 'The selected entry types could not be changed safely.')
    } finally {
      setIsChangingType(false)
    }
  }

  async function beginEntryTypeChange(entry: VaultEntrySummary) {
    hideRevealedField()
    setIsLoadingTypeChange(true)
    setTypeChangeError('')
    try {
      setEntryToRetype(await onLoadEntry(entry.id))
    } catch (error) {
      setTypeChangeError(error instanceof Error ? error.message : 'That entry could not be prepared for a type change.')
    } finally {
      setIsLoadingTypeChange(false)
    }
  }

  async function changeEntryType(draft: VaultEntryDraft) {
    setIsChangingType(true)
    setTypeChangeError('')
    try {
      const saved = await onSaveEntry(draft)
      setSelectedEntryId(saved.entryId)
      setEntryToRetype(null)
      resetEntryEditor()
    } catch (error) {
      setTypeChangeError(error instanceof Error ? error.message : 'The entry type could not be changed safely.')
    } finally {
      setIsChangingType(false)
    }
  }

  async function renameVault(name: string) {
    setIsRenaming(true)
    setRenameError('')
    try {
      await onRenameVault(name)
      setRenameDialogOpen(false)
    } catch (error) {
      setRenameError(error instanceof Error ? error.message : 'The vault could not be renamed safely.')
    } finally {
      setIsRenaming(false)
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
  const gridWidth = vaultGridRef.current?.getBoundingClientRect().width || 1200
  const folderWidthNow = Math.round(columnWidths?.folders || folderColumnRef.current?.getBoundingClientRect().width || folderColumnMinWidth)
  const entryWidthNow = Math.round(columnWidths?.entries || entryColumnRef.current?.getBoundingClientRect().width || entryColumnMinWidth)
  const folderWidthMax = Math.max(folderColumnMinWidth, Math.round(gridWidth - entryColumnMinWidth - detailColumnMinWidth - columnResizeHandleWidth * 2))
  const entryWidthMax = Math.max(entryColumnMinWidth, Math.round(gridWidth - folderColumnMinWidth - detailColumnMinWidth - columnResizeHandleWidth * 2))

  return <div className="vault-browser">
    <header className="vault-browser-header"><div className="vault-browser-title"><div className="vault-browser-name-row"><h1>{vault.databaseName}</h1>{canEdit && <button aria-label="Rename vault" className="vault-name-action" disabled={isRenaming || isDeleting} onClick={() => { setRenameError(''); setRenameDialogOpen(true) }} title="Rename vault" type="button"><Pencil aria-hidden="true" size={15} /></button>}</div><p className="vault-browser-meta"><span>KDBX {vault.version}</span><span>{activeEntries.length} {activeEntries.length === 1 ? 'entry' : 'entries'}</span><span>Decrypted in memory</span></p></div><div className="vault-browser-actions"><button aria-label="Lock vault" className="button button-secondary button-icon" onClick={onLock} title="Lock vault" type="button"><LockKeyhole aria-hidden="true" /></button></div></header>
    {!canEdit && <p className="read-only-note">This device file is open read only. Connect and open its Dropbox copy to add or edit entries.</p>}
    <div className="vault-browser-grid" ref={vaultGridRef} style={columnWidths ? { gridTemplateColumns: `${columnWidths.folders}px ${columnResizeHandleWidth}px ${columnWidths.entries}px ${columnResizeHandleWidth}px minmax(${detailColumnMinWidth}px, 1fr)` } : undefined}>
      <aside className="group-list" aria-label="Vault folders" ref={folderColumnRef}>
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
            {!unfiledEntries.length && draggedEntryId && <p>Drop here to remove from folder</p>}
          </div>
        </div>
        {recycleBin && <div className="recycle-bin-dock"><button
          className={`group-nav-button ${selectedGroupId === recycleBin.id ? 'is-selected' : ''}`}
          onClick={() => selectGroup(recycleBin.id)}
          title={recycleBin.path}
          type="button"
        ><span>Recycle Bin</span><small>{recycleBin.entryCount}</small></button></div>}
      </aside>
      <div
        aria-label="Resize Folders and Keys columns"
        aria-orientation="vertical"
        aria-valuemax={folderWidthMax}
        aria-valuemin={folderColumnMinWidth}
        aria-valuenow={folderWidthNow}
        className="column-resizer"
        onDoubleClick={resetColumnWidths}
        onKeyDown={(event) => resizeColumnWithKeyboard(event, 'folders')}
        onPointerCancel={finishColumnResize}
        onPointerDown={(event) => beginColumnResize(event, 'folders')}
        onPointerMove={continueColumnResize}
        onPointerUp={finishColumnResize}
        role="separator"
        tabIndex={0}
        title="Resize Folders and Keys. Use arrow keys or drag; double-click to reset."
      />
      <section className="entry-list" aria-label="Vault entries" ref={entryColumnRef}>
        {moveStatus && <p aria-live="polite" className="visually-hidden">{moveStatus}</p>}
        <div className={`panel-heading entry-panel-heading ${selectionMode ? 'is-selecting' : ''}`}><span className="entry-panel-title"><h2>Keys</h2>{selectionMode && <small aria-live="polite">{selectedVisibleEntryIds.size} selected</small>}</span><span className="entry-selection-actions">
          {selectionMode ? <>
              <button aria-label={selectedVisibleEntryIds.size === visibleEntries.length ? 'Clear selection' : `Select all ${visibleEntries.length} entries`} className="panel-action" disabled={isDeleting} onClick={() => setSelectedEntryIds(selectedVisibleEntryIds.size === visibleEntries.length ? new Set() : new Set(visibleEntries.map((entry) => entry.id)))} title={selectedVisibleEntryIds.size === visibleEntries.length ? 'Clear selection' : 'Select all'} type="button">{selectedVisibleEntryIds.size === visibleEntries.length ? <CheckSquare aria-hidden="true" size={18} /> : <ListChecks aria-hidden="true" size={18} />}</button>
              <button aria-label="Change selected entry types" className="panel-action" disabled={!selectedVisibleEntryIds.size || isDeleting || isChangingType} onClick={() => { setTypeChangeError(''); setEntriesToRetype(visibleEntries.filter((entry) => selectedVisibleEntryIds.has(entry.id))) }} title="Change entry type" type="button"><Tags aria-hidden="true" size={18} /></button>
              <button aria-label="Delete selected entries forever" className="panel-action is-danger" disabled={!selectedVisibleEntryIds.size || isDeleting} onClick={() => { setDeleteError(''); setEntriesToDeleteForever(visibleEntries.filter((entry) => selectedVisibleEntryIds.has(entry.id))) }} title="Delete selected forever" type="button"><Trash2 aria-hidden="true" size={18} /></button>
              <button aria-label="Stop selecting entries" className="panel-action" disabled={isDeleting} onClick={stopSelecting} title="Done selecting" type="button"><X aria-hidden="true" size={18} /></button>
          </> : <>{canEdit && visibleEntries.length > 0 && <button aria-label="Select multiple entries" className="panel-action" onClick={() => { setSelectionMode(true); setSelectedEntryIds(new Set()) }} title="Select multiple entries" type="button"><ListChecks aria-hidden="true" size={17} /></button>}{canEdit && <button aria-label="Add entry" className="panel-action" disabled={isSaving || isDeleting} onClick={beginCreate} title="Add entry" type="button"><Plus aria-hidden="true" size={17} /></button>}</>}
        </span></div>
        {visibleEntries.map((entry) => <div
          className={`entry-row ${!selectionMode && selectedEntryId === entry.id ? 'is-selected' : ''} ${selectionMode && selectedVisibleEntryIds.has(entry.id) ? 'is-bulk-selected' : ''} ${draggedEntryId === entry.id ? 'is-dragging' : ''} ${selectionMode ? 'is-selecting' : ''}`}
          key={entry.id}
        >
          <button
            className="entry-row-open"
            draggable={!selectionMode && canEdit && !entry.isDeleted && !isMovingEntry}
            onClick={() => { if (selectionMode) toggleEntrySelection(entry.id); else { setSelectedEntryId(entry.id); resetEntryEditor() } }}
            onDragEnd={() => { const wasActive = Boolean(nativeDragEntryIdRef.current); clearDragState(); if (wasActive && !isMovingEntry) setMoveStatus('Move canceled. Drop entries on No folder or another folder.') }}
            onDragStart={(event) => beginNativeDrag(event, entry)}
            type="button"
          >{selectionMode && <span className="entry-selection-mark" aria-hidden="true">{selectedVisibleEntryIds.has(entry.id) ? <CheckSquare size={19} /> : <Square size={19} />}</span>}<span className="entry-type-reference"><EntryTypeIcon size={16} type={entry.type} /></span><span><strong>{entry.title}</strong><small>{entry.subtitle}</small></span></button>
          {!selectionMode && canEdit && !entry.isDeleted && <button
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
        </div>)}
      </section>
      <div
        aria-label="Resize Keys and entry detail columns"
        aria-orientation="vertical"
        aria-valuemax={entryWidthMax}
        aria-valuemin={entryColumnMinWidth}
        aria-valuenow={entryWidthNow}
        className="column-resizer"
        onDoubleClick={resetColumnWidths}
        onKeyDown={(event) => resizeColumnWithKeyboard(event, 'entries')}
        onPointerCancel={finishColumnResize}
        onPointerDown={(event) => beginColumnResize(event, 'entries')}
        onPointerMove={continueColumnResize}
        onPointerUp={finishColumnResize}
        role="separator"
        tabIndex={0}
        title="Resize Keys and detail. Use arrow keys or drag; double-click to reset."
      />
      <section className="entry-detail" aria-label="Selected entry">
        {selectionMode ? <div className="bulk-selection-summary"><span className="entry-glyph entry-glyph-large"><ListChecks aria-hidden="true" size={21} /></span><div><p className="eyebrow">Bulk selection</p><h2>{selectedVisibleEntryIds.size ? `${selectedVisibleEntryIds.size} selected` : 'Choose entries'}</h2><p>Select entries from this folder, then use the trash icon to delete them permanently.</p></div></div> : choosingType ? <div className="entry-type-picker"><div className="entry-editor-heading"><div><p className="eyebrow">New entry</p><h2>Choose a type</h2></div></div><p className="type-picker-copy">The type controls which fields appear in the entry.</p><div className="entry-type-grid">{entryTypeDefinitions.map((type) => <button key={type.id} onClick={() => chooseType(type.id)} type="button"><span className="entry-glyph"><EntryTypeIcon type={type.id} /></span><span><strong>{type.label}</strong><small>{type.description}</small></span></button>)}</div><button className="text-button" onClick={resetEntryEditor} type="button">Cancel</button></div> : draft && definition ? <form autoComplete="off" className="entry-editor" onSubmit={saveEntry}>
          <div className="entry-editor-heading"><div><p className="eyebrow">{draft.id ? `Edit ${definition.label}` : `New ${definition.label}`}</p><h2>{draft.id ? draft.title || `Untitled ${definition.label}` : `Add ${definition.label}`}</h2></div>{!draft.id && <button className="text-button" onClick={() => { setDraft(null); setChoosingType(true) }} type="button">Change type</button>}</div>
          <label className="field"><span>Name</span><input autoFocus autoComplete="off" disabled={isSaving} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required value={draft.title} /></label>
          <label className="field"><span>Folder</span><select disabled={isSaving} onChange={(event) => setDraft({ ...draft, groupId: event.target.value })} value={draft.groupId}><option value={vault.rootGroupId}>No folder</option>{vault.groups.filter((group) => !group.isRecycleBin).map((group) => <option key={group.id} value={group.id}>{group.path}</option>)}</select></label>
          {definition.fields.map((field) => <EntryField disabled={isSaving} field={field} key={field.key} onChange={(value) => setDraft({ ...draft, fields: { ...draft.fields, [field.key]: value } })} onGenerate={field.key === 'password' ? () => setDraft({ ...draft, fields: { ...draft.fields, [field.key]: generateServicePassword() } }) : undefined} onToggle={() => setVisibleSecrets((current) => { const next = new Set(current); if (next.has(field.key)) next.delete(field.key); else next.add(field.key); return next })} value={draft.fields[field.key] || ''} visible={visibleSecrets.has(field.key)} />)}
          {saveError && <p className="unlock-error" role="alert">{saveError}</p>}<div className="entry-editor-actions"><button className="button button-secondary" disabled={isSaving} onClick={resetEntryEditor} type="button">Cancel</button><button className="button button-primary" disabled={isSaving} type="submit">{isSaving ? 'Encrypting and saving…' : 'Save entry'}</button></div>
        </form> : selectedEntry ? <><div className="entry-detail-heading">{!selectedEntry.isDeleted && canEdit ? <button aria-label={`Change ${selectedEntry.title} entry type`} aria-busy={isLoadingTypeChange || undefined} className="entry-glyph entry-glyph-large entry-type-button" disabled={isLoadingTypeChange || isChangingType} onClick={() => void beginEntryTypeChange(selectedEntry)} title="Change entry type" type="button">{isLoadingTypeChange ? <LoaderCircle aria-hidden="true" className="is-spinning" size={21} /> : <EntryTypeIcon size={21} type={selectedEntry.type} />}</button> : <span className="entry-glyph entry-glyph-large"><EntryTypeIcon size={21} type={selectedEntry.type} /></span>}<div><p className="eyebrow">{selectedEntry.isDeleted ? 'Recycle Bin' : entryTypeLabel(selectedEntry.type)}</p><h2>{selectedEntry.title}</h2></div></div><dl><div><dt>Type</dt><dd>{entryTypeLabel(selectedEntry.type)}</dd></div><div><dt>Folder</dt><dd>{selectedEntry.groupId === vault.rootGroupId ? 'No folder' : vault.groups.find((group) => group.id === selectedEntry.groupId)?.path || '—'}</dd></div>{selectedEntry.username && <div><dt>Username</dt><dd>{selectedEntry.username}</dd></div>}{selectedEntry.url && <div><dt>Website</dt><dd>{selectedEntry.url}</dd></div>}{selectedProtectedFields.map((field) => {
          const isCurrent = copyState?.entryId === selectedEntry.id && copyState.fieldKey === field.key
          const isCopying = isCurrent && copyState.status === 'copying'
          const isCopied = isCurrent && copyState.status === 'copied'
          const isRevealCurrent = revealState?.entryId === selectedEntry.id && revealState.fieldKey === field.key
          const isRevealing = isRevealCurrent && revealState.status === 'loading'
          const isRevealed = isRevealCurrent && revealState.status === 'revealed'
          return <div className="protected-detail-row" key={field.key}><dt>{field.label}</dt><dd><span aria-label={isRevealed ? `${field.label} revealed` : `${field.label} hidden`} className={isRevealed ? 'revealed-secret' : 'masked-secret'}>{isRevealed ? revealState.value : '••••••••••••'}</span><span className="protected-field-actions"><button aria-label={`${isRevealed ? 'Hide' : 'Reveal'} ${field.label.toLowerCase()}`} aria-busy={isRevealing || undefined} aria-pressed={isRevealed} className="protected-field-button" disabled={isRevealing} onClick={() => void toggleProtectedFieldReveal(selectedEntry, field)} title={`${isRevealed ? 'Hide' : 'Reveal'} ${field.label.toLowerCase()}`} type="button">{isRevealing ? <LoaderCircle aria-hidden="true" className="is-spinning" size={17} /> : isRevealed ? <EyeOff aria-hidden="true" size={17} /> : <Eye aria-hidden="true" size={17} />}</button><button aria-label={`Copy ${field.label.toLowerCase()}`} aria-busy={isCopying || undefined} className={`protected-field-button ${isCopied ? 'is-copied' : ''}`} disabled={isCopying} onClick={() => void copyProtectedField(selectedEntry, field)} title={isCopied ? `${field.label} copied` : `Copy ${field.label.toLowerCase()}`} type="button">{isCopying ? <LoaderCircle aria-hidden="true" className="is-spinning" size={17} /> : isCopied ? <Check aria-hidden="true" size={17} /> : <Copy aria-hidden="true" size={17} />}</button></span></dd></div>
        })}</dl>{copyState?.entryId === selectedEntry.id && <p aria-live="polite" className={`copy-status ${copyState.status === 'error' ? 'is-error' : ''}`} role={copyState.status === 'error' ? 'alert' : 'status'}>{copyState.message}</p>}{revealState?.entryId === selectedEntry.id && <p aria-live="polite" className={`copy-status ${revealState.status === 'error' ? 'is-error' : ''}`} role={revealState.status === 'error' ? 'alert' : 'status'}>{revealState.message}</p>}{saveError && <p className="unlock-error" role="alert">{saveError}</p>}{moveError && <p className="unlock-error" role="alert">{moveError}</p>}{!selectedEntry.isDeleted && canEdit && <div aria-label="Entry actions" className="entry-detail-actions" role="group"><button aria-label={`Edit ${selectedEntry.title}`} aria-busy={isLoadingEntry || undefined} className="button button-secondary button-icon" disabled={isLoadingEntry || isMovingEntry} onClick={() => void beginEdit(selectedEntry)} title={`Edit ${selectedEntry.title}`} type="button">{isLoadingEntry ? <LoaderCircle aria-hidden="true" className="is-spinning" /> : <Pencil aria-hidden="true" />}</button><button aria-label={`Move ${selectedEntry.title}`} className="button button-secondary button-icon" disabled={isMovingEntry || (selectedEntry.groupId === vault.rootGroupId && vault.groups.every((group) => group.isRecycleBin))} onClick={() => { setMoveError(''); setEntryToMove(selectedEntry) }} title={`Move ${selectedEntry.title}`} type="button"><FolderInput aria-hidden="true" /></button><button aria-label={`Delete ${selectedEntry.title}`} className="button button-icon button-icon-danger" disabled={isMovingEntry} onClick={() => { setDeleteError(''); setEntryToDelete(selectedEntry) }} title={`Delete ${selectedEntry.title}`} type="button"><Trash2 aria-hidden="true" /></button></div>}<p className="read-only-note">Protected values stay masked and are decrypted one at a time only when you copy, reveal, or edit them.</p></> : <p className="vault-empty-state">Choose an entry or add a new one.</p>}
      </section>
    </div>
    {entryToDelete && <DeleteEntryDialog entry={entryToDelete} error={deleteError} isDeleting={isDeleting} onCancel={() => { if (!isDeleting) { setDeleteError(''); setEntryToDelete(null) } }} onDelete={() => void deleteEntry()} />}
    {entriesToDeleteForever.length > 0 && <DeleteEntriesForeverDialog entries={entriesToDeleteForever} error={deleteError} isDeleting={isDeleting} onCancel={() => { if (!isDeleting) { setDeleteError(''); setEntriesToDeleteForever([]) } }} onDelete={() => void deleteEntriesForever()} />}
    {entriesToRetype.length > 0 && <ChangeEntriesTypeDialog entries={entriesToRetype} error={typeChangeError} isSaving={isChangingType} onCancel={() => { if (!isChangingType) { setTypeChangeError(''); setEntriesToRetype([]) } }} onSave={(type) => void changeEntriesType(type)} />}
    {entryToRetype && <ChangeEntryTypeDialog entry={entryToRetype} error={typeChangeError} isSaving={isChangingType} onCancel={() => { if (!isChangingType) { setTypeChangeError(''); setEntryToRetype(null) } }} onSave={(draft) => void changeEntryType(draft)} />}
    {entryToMove && <MoveEntryDialog entry={entryToMove} error={moveError} isMoving={isMovingEntry} onCancel={() => { if (!isMovingEntry) { setMoveError(''); setEntryToMove(null) } }} onMove={(groupId) => void moveEntry(entryToMove.id, groupId)} vault={vault} />}
    {groupDialog && <GroupNameDialog error={groupError} group={groupDialog === 'new' ? null : groupDialog} isSaving={isSavingGroup} onCancel={() => { if (!isSavingGroup) { setGroupError(''); setGroupDialog(null) } }} onSave={(group) => void saveGroup(group)} rootGroupId={vault.rootGroupId} />}
    {groupToDelete && <DeleteGroupDialog error={groupError} group={groupToDelete} isDeleting={isSavingGroup} onCancel={() => { if (!isSavingGroup) { setGroupError(''); setGroupToDelete(null) } }} onDelete={() => void deleteGroup()} />}
    {renameDialogOpen && <RenameVaultDialog currentName={vault.databaseName} error={renameError} isSaving={isRenaming} onCancel={() => { if (!isRenaming) { setRenameError(''); setRenameDialogOpen(false) } }} onSave={(name) => void renameVault(name)} />}
  </div>
}
