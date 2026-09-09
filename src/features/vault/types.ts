export type VaultEntrySummary = {
  id: string
  groupId: string
  title: string
  username: string
  url: string
  hasPassword: boolean
  icon: number | null
}

export type VaultGroupSummary = {
  id: string
  name: string
  path: string
  depth: number
  entryCount: number
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

export type VaultWorkerResponse =
  | { type: 'progress'; stage: 'reading' | 'decrypting' | 'mapping' | 'creating' | 'encrypting' }
  | { type: 'success'; vault: VaultSnapshot }
  | { type: 'created'; data: ArrayBuffer; fileName: string }
  | { type: 'error'; code: VaultOpenErrorCode; message: string }
