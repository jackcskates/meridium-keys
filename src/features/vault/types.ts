export type VaultEntrySummary = {
  id: string
  groupId: string
  title: string
  username: string
  url: string
  hasPassword: boolean
  icon: number | null
  isDeleted: boolean
}

export type VaultEntryDraft = {
  id?: string
  groupId: string
  title: string
  username: string
  password: string
  url: string
  notes: string
}

export type VaultEntryDetails = VaultEntryDraft & {
  id: string
}

export type VaultGroupSummary = {
  id: string
  name: string
  path: string
  depth: number
  entryCount: number
  isRecycleBin: boolean
}

export type VaultSnapshot = {
  fileName: string
  databaseName: string
  version: string
  groups: VaultGroupSummary[]
  entries: VaultEntrySummary[]
}

export type VaultOpenErrorCode =
  | 'EMPTY_PASSWORD'
  | 'FILE_TOO_LARGE'
  | 'INVALID_CREDENTIALS'
  | 'NOT_KDBX'
  | 'UNSUPPORTED_KDBX'
  | 'CORRUPT_KDBX'
  | 'WORKER_FAILURE'

export type VaultWorkerRequest =
  | { type: 'unlock'; file: File; password: string }
  | { type: 'create'; databaseName: string; fileName: string; password: string }
  | { type: 'get-entry'; entryId: string; requestId: string }
  | { type: 'prepare-entry-save'; entry: VaultEntryDraft; requestId: string }
  | { type: 'prepare-entry-delete'; entryId: string; requestId: string }
  | { type: 'finish-entry-save'; changeId: string; commit: boolean; requestId: string }

export type VaultWorkerResponse =
  | { type: 'progress'; stage: 'reading' | 'decrypting' | 'mapping' | 'creating' | 'encrypting' }
  | { type: 'success'; vault: VaultSnapshot }
  | { type: 'created'; data: ArrayBuffer; fileName: string }
  | { type: 'entry'; entry: VaultEntryDetails; requestId: string }
  | { type: 'entry-save-prepared'; changeId: string; data: ArrayBuffer; entryId?: string; requestId: string; vault: VaultSnapshot }
  | { type: 'entry-save-finished'; requestId: string; vault: VaultSnapshot }
  | { type: 'error'; code: VaultOpenErrorCode; message: string; requestId?: string }
