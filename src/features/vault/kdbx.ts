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
) {
  const name = group.name?.trim() || 'Untitled group'
  const pathParts = [...parentPath, name]
  const groupId = group.uuid.toString()

  groups.push({
    id: groupId,
    name,
    path: pathParts.join(' / '),
    depth,
    entryCount: group.entries.length,
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
    })
  }

  for (const child of group.groups) {
    mapGroup(child, pathParts, depth + 1, groups, entries)
  }
}

function mapError(error: unknown): VaultOpenError {
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

export async function readKdbxSnapshot(
  data: ArrayBuffer,
  password: string,
  fileName = 'Vault.kdbx',
): Promise<VaultSnapshot> {
  if (!password) {
    throw new VaultOpenError('EMPTY_PASSWORD', 'Enter this vault’s master password.')
  }

  configureArgon2()

  try {
    const credentials = new Credentials(ProtectedValue.fromString(password))
    const database = await Kdbx.load(data, credentials)
    const groups: VaultGroupSummary[] = []
    const entries: VaultEntrySummary[] = []

    for (const root of database.groups) {
      mapGroup(root, [], 0, groups, entries)
    }

    return {
      fileName,
      databaseName: database.meta.name?.trim() || fileName.replace(/\.kdbx$/i, ''),
      version: `${database.versionMajor}.${database.versionMinor}`,
      groups,
      entries,
    }
  } catch (error) {
    throw mapError(error)
  }
}
