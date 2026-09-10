import { argon2d, argon2id } from 'hash-wasm'
import {
  Consts,
  Credentials,
  CryptoEngine,
  Int64,
  Kdbx,
  KdbxError,
  ProtectedValue,
  VarDictionary,
  type KdbxEntry,
  type KdbxGroup,
} from 'kdbxweb'
import type {
  VaultEntryDetails,
  VaultEntryDraft,
  VaultEntrySummary,
  VaultGroupSummary,
  VaultOpenErrorCode,
  VaultSnapshot,
} from './types'

const currentArgon2Version = 0x13
let argon2Configured = false

export class VaultOpenError extends Error {
  readonly code: VaultOpenErrorCode

  constructor(
    code: VaultOpenErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'VaultOpenError'
    this.code = code
  }
}

export function configureArgon2() {
  if (argon2Configured) return

  CryptoEngine.setArgon2Impl(async (
    password,
    salt,
    memory,
    iterations,
    length,
    parallelism,
    type,
    version,
  ) => {
    if (version !== currentArgon2Version) {
      throw new VaultOpenError(
        'UNSUPPORTED_KDBX',
        'This vault uses the obsolete Argon2 version 1.0. Re-save it with a current KeePass application before opening it here.',
      )
    }

    const hash = await (type === CryptoEngine.Argon2TypeArgon2d ? argon2d : argon2id)({
      password: new Uint8Array(password),
      salt: new Uint8Array(salt),
      memorySize: memory,
      iterations,
      hashLength: length,
      parallelism,
      outputType: 'binary',
    })

    return hash.buffer.slice(hash.byteOffset, hash.byteOffset + hash.byteLength) as ArrayBuffer
  })

  argon2Configured = true
}

export async function createKdbxData(databaseName: string, password: string) {
  if (!password) throw new VaultOpenError('EMPTY_PASSWORD', 'Enter a master password for this vault.')

  configureArgon2()
  const credentials = new Credentials(ProtectedValue.fromString(password))
  const database = Kdbx.create(credentials, databaseName)
  database.setKdf(Consts.KdfId.Argon2id)

  const parameters = database.header.kdfParameters
  if (!parameters) throw new VaultOpenError('WORKER_FAILURE', 'The secure vault settings could not be created.')
  parameters.set('M', VarDictionary.ValueType.UInt64, Int64.from(64 * 1024 * 1024))
  parameters.set('I', VarDictionary.ValueType.UInt64, Int64.from(3))
  parameters.set('P', VarDictionary.ValueType.UInt32, 1)

  return database.save()
}

function plainField(entry: KdbxEntry, name: string) {
  const value = entry.fields.get(name)
  return typeof value === 'string' ? value : ''
}

function hasProtectedPassword(entry: KdbxEntry) {
  const value = entry.fields.get('Password')
  return value instanceof ProtectedValue ? value.byteLength > 0 : typeof value === 'string' && value.length > 0
}

function mapGroup(
  group: KdbxGroup,
  parentPath: string[],
  depth: number,
  groups: VaultGroupSummary[],
  entries: VaultEntrySummary[],
  recycleBinId: string,
  insideRecycleBin = false,
) {
  const name = group.name?.trim() || 'Untitled group'
  const pathParts = [...parentPath, name]
  const groupId = group.uuid.toString()
  const isRecycleBin = insideRecycleBin || groupId === recycleBinId

  groups.push({
    id: groupId,
    name,
    path: pathParts.join(' / '),
    depth,
    entryCount: group.entries.length,
    isRecycleBin,
  })

  for (const entry of group.entries) {
    entries.push({
      id: entry.uuid.toString(),
      groupId,
      title: plainField(entry, 'Title').trim() || 'Untitled entry',
      username: plainField(entry, 'UserName'),
      url: plainField(entry, 'URL'),
      hasPassword: hasProtectedPassword(entry),
      icon: typeof entry.icon === 'number' ? entry.icon : null,
      isDeleted: isRecycleBin,
    })
  }

  for (const child of group.groups) {
    mapGroup(child, pathParts, depth + 1, groups, entries, recycleBinId, isRecycleBin)
  }
}

export function mapKdbxError(error: unknown): VaultOpenError {
  if (error instanceof VaultOpenError) return error

  if (error instanceof KdbxError) {
    switch (error.code) {
      case Consts.ErrorCodes.InvalidKey:
        return new VaultOpenError('INVALID_CREDENTIALS', 'That master password did not unlock this vault.')
      case Consts.ErrorCodes.BadSignature:
        return new VaultOpenError('NOT_KDBX', 'This file is not a valid KDBX vault.')
      case Consts.ErrorCodes.InvalidVersion:
      case Consts.ErrorCodes.Unsupported:
      case Consts.ErrorCodes.NotImplemented:
        return new VaultOpenError('UNSUPPORTED_KDBX', 'This KDBX version or encryption configuration is not supported yet.')
      case Consts.ErrorCodes.FileCorrupt:
        return new VaultOpenError('CORRUPT_KDBX', 'This vault appears to be damaged or incomplete.')
    }
  }

  return new VaultOpenError('WORKER_FAILURE', 'The vault could not be opened. No vault data was retained.')
}

export function mapKdbxSnapshot(database: Kdbx, fileName = 'Vault.kdbx'): VaultSnapshot {
  const groups: VaultGroupSummary[] = []
  const entries: VaultEntrySummary[] = []

  const recycleBinId = database.meta.recycleBinUuid?.toString() || ''
  for (const root of database.groups) {
    mapGroup(root, [], 0, groups, entries, recycleBinId)
  }

  return {
    fileName,
    databaseName: database.meta.name?.trim() || fileName.replace(/\.kdbx$/i, ''),
    version: `${database.versionMajor}.${database.versionMinor}`,
    groups,
    entries,
  }
}

export async function loadKdbxDatabase(data: ArrayBuffer, password: string) {
  if (!password) throw new VaultOpenError('EMPTY_PASSWORD', 'Enter this vault’s master password.')

  configureArgon2()
  try {
    return await Kdbx.load(data, new Credentials(ProtectedValue.fromString(password)))
  } catch (error) {
    throw mapKdbxError(error)
  }
}

function findEntry(database: Kdbx, entryId: string) {
  for (const root of database.groups) {
    for (const entry of root.allEntries()) {
      if (entry.uuid.toString() === entryId) return entry
    }
  }
  return undefined
}

function entryFieldText(entry: KdbxEntry, name: string) {
  const value = entry.fields.get(name)
  return value instanceof ProtectedValue ? value.getText() : typeof value === 'string' ? value : ''
}

export function readKdbxEntryDetails(database: Kdbx, entryId: string): VaultEntryDetails {
  const entry = findEntry(database, entryId)
  if (!entry?.parentGroup) throw new VaultOpenError('WORKER_FAILURE', 'That entry could not be found in the open vault.')

  return {
    id: entry.uuid.toString(),
    groupId: entry.parentGroup.uuid.toString(),
    title: entryFieldText(entry, 'Title'),
    username: entryFieldText(entry, 'UserName'),
    password: entryFieldText(entry, 'Password'),
    url: entryFieldText(entry, 'URL'),
    notes: entryFieldText(entry, 'Notes'),
  }
}

export async function prepareKdbxEntrySave(database: Kdbx, draft: VaultEntryDraft, fileName: string) {
  if (!draft.title.trim()) throw new VaultOpenError('WORKER_FAILURE', 'Give this entry a name before saving it.')

  try {
    const clonedData = await database.save()
    const workingDatabase = await Kdbx.load(clonedData, database.credentials)
    const group = workingDatabase.getGroup(draft.groupId) || workingDatabase.getDefaultGroup()
    let entry = draft.id ? findEntry(workingDatabase, draft.id) : undefined

    if (draft.id && !entry) throw new VaultOpenError('WORKER_FAILURE', 'That entry no longer exists in the open vault.')
    if (entry) {
      entry.pushHistory()
      if (entry.parentGroup !== group) workingDatabase.move(entry, group)
    } else {
      entry = workingDatabase.createEntry(group)
    }

    entry.fields.set('Title', draft.title.trim())
    entry.fields.set('UserName', draft.username)
    entry.fields.set('Password', ProtectedValue.fromString(draft.password))
    entry.fields.set('URL', draft.url)
    entry.fields.set('Notes', draft.notes)
    entry.times.update()

    const data = await workingDatabase.save()
    return {
      database: workingDatabase,
      data,
      vault: mapKdbxSnapshot(workingDatabase, fileName),
      entryId: entry.uuid.toString(),
    }
  } catch (error) {
    throw mapKdbxError(error)
  }
}

export async function prepareKdbxEntryDelete(database: Kdbx, entryId: string, fileName: string) {
  try {
    const clonedData = await database.save()
    const workingDatabase = await Kdbx.load(clonedData, database.credentials)
    const entry = findEntry(workingDatabase, entryId)
    if (!entry) throw new VaultOpenError('WORKER_FAILURE', 'That entry no longer exists in the open vault.')
    workingDatabase.remove(entry)
    const data = await workingDatabase.save()
    return {
      database: workingDatabase,
      data,
      vault: mapKdbxSnapshot(workingDatabase, fileName),
    }
  } catch (error) {
    throw mapKdbxError(error)
  }
}

export async function readKdbxSnapshot(
  data: ArrayBuffer,
  password: string,
  fileName = 'Vault.kdbx',
): Promise<VaultSnapshot> {
  const database = await loadKdbxDatabase(data, password)
  return mapKdbxSnapshot(database, fileName)
}
