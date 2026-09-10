export type VaultEntryType =
  | 'note'
  | 'login'
  | 'account'
  | 'database'
  | 'password'
  | 'api-key'
  | 'identity'
  | 'membership'
  | 'crypto-wallet'
  | 'serial-number'

export type VaultEntrySummary = {
  id: string
  groupId: string
  type: VaultEntryType
  title: string
  username: string
  url: string
  subtitle: string
  hasPassword: boolean
  protectedFieldKeys: string[]
  icon: number | null
  isDeleted: boolean
}

export type VaultEntryDraft = {
  id?: string
  groupId: string
  type: VaultEntryType
  title: string
  fields: Record<string, string>
}

export type VaultEntryDetails = VaultEntryDraft & {
  id: string
}

export type VaultGroupSummary = {
  id: string
  parentGroupId: string
  name: string
  path: string
  depth: number
  entryCount: number
  isRecycleBin: boolean
}

export type VaultGroupDraft = {
  id?: string
  parentGroupId: string
  name: string
}

export type VaultSnapshot = {
  fileName: string
  databaseName: string
  version: string
  rootGroupId: string
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
  | { type: 'get-protected-field'; entryId: string; fieldKey: string; requestId: string }
  | { type: 'prepare-entry-save'; entry: VaultEntryDraft; requestId: string }
  | { type: 'prepare-entry-delete'; entryId: string; requestId: string }
  | { type: 'prepare-entry-move'; entryId: string; groupId: string; requestId: string }
  | { type: 'prepare-group-save'; group: VaultGroupDraft; requestId: string }
  | { type: 'prepare-group-delete'; groupId: string; requestId: string }
  | { type: 'finish-change'; changeId: string; commit: boolean; requestId: string }

export type VaultWorkerResponse =
  | { type: 'progress'; stage: 'reading' | 'decrypting' | 'mapping' | 'creating' | 'encrypting' }
  | { type: 'success'; vault: VaultSnapshot }
  | { type: 'created'; data: ArrayBuffer; fileName: string }
  | { type: 'entry'; entry: VaultEntryDetails; requestId: string }
  | { type: 'protected-field'; value: string; requestId: string }
  | { type: 'change-prepared'; changeId: string; data: ArrayBuffer; entryId?: string; groupId?: string; requestId: string; vault: VaultSnapshot }
  | { type: 'change-finished'; requestId: string; vault: VaultSnapshot }
  | { type: 'error'; code: VaultOpenErrorCode; message: string; requestId?: string }
