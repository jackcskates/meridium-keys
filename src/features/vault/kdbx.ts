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
  VaultGroupDraft,
  VaultGroupSummary,
  VaultOpenErrorCode,
  VaultSnapshot,
} from './types'
import { allTypedStorageKeys, entryTypeMetadataKey, getEntryTypeDefinition, isVaultEntryType } from './entryTypes'

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
  return [...entry.fields.values()].some((value) => value instanceof ProtectedValue && value.byteLength > 0)
}

function entryTypeFor(entry: KdbxEntry) {
  const storedType = plainField(entry, entryTypeMetadataKey)
  if (isVaultEntryType(storedType)) return storedType
  return plainField(entry, 'UserName') || plainField(entry, 'URL') || hasProtectedPassword(entry) ? 'login' : 'note'
}

function mapGroup(
  group: KdbxGroup,
  parentPath: string[],
  depth: number,
  groups: VaultGroupSummary[],
  entries: VaultEntrySummary[],
  recycleBinId: string,
  insideRecycleBin = false,
  includeGroup = true,
) {
  const name = group.name?.trim() || 'Untitled group'
  const pathParts = includeGroup ? [...parentPath, name] : parentPath
  const groupId = group.uuid.toString()
  const isRecycleBin = insideRecycleBin || groupId === recycleBinId

  if (includeGroup) {
    groups.push({
      id: groupId,
      parentGroupId: group.parentGroup?.uuid.toString() || '',
      name,
      path: pathParts.join(' / '),
      depth,
      entryCount: [...group.allEntries()].length,
      isRecycleBin,
    })
  }

  for (const entry of group.entries) {
    const type = entryTypeFor(entry)
    const definition = getEntryTypeDefinition(type)
    const subtitle = definition.summaryKeys
      .map((key) => definition.fields.find((field) => field.key === key))
      .map((field) => field ? plainField(entry, field.storageKey).trim() : '')
      .find(Boolean) || definition.label
    entries.push({
      id: entry.uuid.toString(),
      groupId,
      type,
      title: plainField(entry, 'Title').trim() || 'Untitled entry',
      username: plainField(entry, 'UserName'),
      url: plainField(entry, 'URL'),
      subtitle,
      hasPassword: hasProtectedPassword(entry),
      icon: typeof entry.icon === 'number' ? entry.icon : null,
      isDeleted: isRecycleBin,
    })
  }

  for (const child of group.groups) {
    mapGroup(child, pathParts, includeGroup ? depth + 1 : depth, groups, entries, recycleBinId, isRecycleBin)
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
    mapGroup(root, [], 0, groups, entries, recycleBinId, false, false)
  }
  const rootGroupId = database.getDefaultGroup().uuid.toString()

  return {
    fileName,
    databaseName: database.meta.name?.trim() || fileName.replace(/\.kdbx$/i, ''),
    version: `${database.versionMajor}.${database.versionMinor}`,
    rootGroupId,
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

function findGroup(database: Kdbx, groupId: string) {
  for (const root of database.groups) {
    for (const group of root.allGroups()) {
      if (group.uuid.toString() === groupId) return group
    }
  }
  return undefined
}

function groupIsInRecycleBin(group: KdbxGroup, recycleBinId: string) {
  let current: KdbxGroup | undefined = group
  while (current) {
    if (current.uuid.toString() === recycleBinId) return true
    current = current.parentGroup
  }
  return false
}

function entryFieldText(entry: KdbxEntry, name: string) {
  const value = entry.fields.get(name)
  return value instanceof ProtectedValue ? value.getText() : typeof value === 'string' ? value : ''
}

export function readKdbxEntryDetails(database: Kdbx, entryId: string): VaultEntryDetails {
  const entry = findEntry(database, entryId)
  if (!entry?.parentGroup) throw new VaultOpenError('WORKER_FAILURE', 'That entry could not be found in the open vault.')

  const type = entryTypeFor(entry)
  const definition = getEntryTypeDefinition(type)

  return {
    id: entry.uuid.toString(),
    groupId: entry.parentGroup.uuid.toString(),
    type,
    title: entryFieldText(entry, 'Title'),
    fields: Object.fromEntries(definition.fields.map((field) => [field.key, entryFieldText(entry, field.storageKey)])),
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

    const definition = getEntryTypeDefinition(draft.type)
    const requiredField = definition.fields.find((field) => field.required && !draft.fields[field.key]?.trim())
    if (requiredField) throw new VaultOpenError('WORKER_FAILURE', `Enter ${requiredField.label.toLowerCase()} before saving this entry.`)

    for (const storageKey of allTypedStorageKeys()) {
      if (!['UserName', 'Password', 'URL', 'Notes'].includes(storageKey)) entry.fields.delete(storageKey)
    }
    entry.fields.set('Title', draft.title.trim())
    entry.fields.set('UserName', '')
    entry.fields.set('Password', ProtectedValue.fromString(''))
    entry.fields.set('URL', '')
    entry.fields.set('Notes', '')
    entry.fields.set(entryTypeMetadataKey, draft.type)
    for (const field of definition.fields) {
      const value = draft.fields[field.key] || ''
      if (field.kind === 'secret' || field.kind === 'secret-textarea') {
        entry.fields.set(field.storageKey, ProtectedValue.fromString(value))
      } else if (value || ['UserName', 'URL', 'Notes'].includes(field.storageKey)) {
        entry.fields.set(field.storageKey, value)
      }
    }
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

export async function prepareKdbxGroupSave(database: Kdbx, draft: VaultGroupDraft, fileName: string) {
  const name = draft.name.trim()
  if (!name) throw new VaultOpenError('WORKER_FAILURE', 'Give this folder a name before saving it.')

  try {
    const clonedData = await database.save()
    const workingDatabase = await Kdbx.load(clonedData, database.credentials)
    const root = workingDatabase.getDefaultGroup()
    const recycleBinId = workingDatabase.meta.recycleBinUuid?.toString()
    const existing = draft.id ? findGroup(workingDatabase, draft.id) : undefined
    if (draft.id && !existing) throw new VaultOpenError('WORKER_FAILURE', 'That folder no longer exists in the open vault.')
    if (existing?.uuid.toString() === root.uuid.toString() || existing?.uuid.toString() === recycleBinId) {
      throw new VaultOpenError('WORKER_FAILURE', 'That system folder cannot be changed.')
    }
    const parent = existing?.parentGroup || findGroup(workingDatabase, draft.parentGroupId) || root
    const duplicate = parent.groups.some((group) => group !== existing && (group.name || '').trim().localeCompare(name, undefined, { sensitivity: 'accent' }) === 0)
    if (duplicate) throw new VaultOpenError('WORKER_FAILURE', `A folder named ${name} already exists here.`)

    const group = existing || workingDatabase.createGroup(parent, name)
    group.name = name
    group.times.update()
    const data = await workingDatabase.save()
    return {
      database: workingDatabase,
      data,
      vault: mapKdbxSnapshot(workingDatabase, fileName),
      groupId: group.uuid.toString(),
    }
  } catch (error) {
    throw mapKdbxError(error)
  }
}

export async function prepareKdbxGroupDelete(database: Kdbx, groupId: string, fileName: string) {
  try {
    const clonedData = await database.save()
    const workingDatabase = await Kdbx.load(clonedData, database.credentials)
    const group = findGroup(workingDatabase, groupId)
    const root = workingDatabase.getDefaultGroup()
    const recycleBinId = workingDatabase.meta.recycleBinUuid?.toString()
    if (!group) throw new VaultOpenError('WORKER_FAILURE', 'That folder no longer exists in the open vault.')
    if (group.uuid.toString() === root.uuid.toString() || group.uuid.toString() === recycleBinId) {
      throw new VaultOpenError('WORKER_FAILURE', 'That system folder cannot be deleted.')
    }
    if (group.entries.length > 0 || group.groups.length > 0) {
      throw new VaultOpenError('WORKER_FAILURE', 'Move or delete everything inside this folder before deleting it.')
    }
    workingDatabase.remove(group)
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

export async function prepareKdbxEntryMove(database: Kdbx, entryId: string, groupId: string, fileName: string) {
  try {
    const clonedData = await database.save()
    const workingDatabase = await Kdbx.load(clonedData, database.credentials)
    const entry = findEntry(workingDatabase, entryId)
    const targetGroup = findGroup(workingDatabase, groupId)
    const recycleBinId = workingDatabase.meta.recycleBinUuid?.toString() || ''
    if (!entry?.parentGroup) throw new VaultOpenError('WORKER_FAILURE', 'That entry no longer exists in the open vault.')
    if (!targetGroup) throw new VaultOpenError('WORKER_FAILURE', 'That destination folder no longer exists in the open vault.')
    if (groupIsInRecycleBin(entry.parentGroup, recycleBinId)) {
      throw new VaultOpenError('WORKER_FAILURE', 'Restore Recycle Bin entries before moving them to another folder.')
    }
    if (groupIsInRecycleBin(targetGroup, recycleBinId)) {
      throw new VaultOpenError('WORKER_FAILURE', 'Entries cannot be dragged into the Recycle Bin.')
    }
    if (entry.parentGroup.uuid.toString() !== targetGroup.uuid.toString()) {
      workingDatabase.move(entry, targetGroup)
      entry.times.update()
    }
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

export async function readKdbxSnapshot(
  data: ArrayBuffer,
  password: string,
  fileName = 'Vault.kdbx',
): Promise<VaultSnapshot> {
  const database = await loadKdbxDatabase(data, password)
  return mapKdbxSnapshot(database, fileName)
}
