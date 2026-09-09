import type { DropboxSession, DropboxVaultFile } from './types'

const apiEndpoint = 'https://api.dropboxapi.com/2'
const contentEndpoint = 'https://content.dropboxapi.com/2'

type DropboxEntry = {
  '.tag': 'file' | 'folder' | 'deleted'
  id?: string
  name: string
  path_display?: string
  rev?: string
  size?: number
  server_modified?: string
}

type ListFolderResponse = {
  entries: DropboxEntry[]
  cursor: string
  has_more: boolean
}

type AccountResponse = {
  name?: { display_name?: string }
}

export class DropboxApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DropboxApiError'
  }
}

async function apiRequest<T>(accessToken: string, route: string, body: object): Promise<T> {
  const response = await fetch(`${apiEndpoint}/${route}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw new DropboxApiError(response.status === 401
      ? 'The Dropbox connection expired. Connect again.'
      : 'Dropbox could not load the vault library. Try again.')
  }
  return response.json() as Promise<T>
}

export async function loadDropboxAccount(session: DropboxSession) {
  const account = await apiRequest<AccountResponse>(session.accessToken, 'users/get_current_account', {})
  return account.name?.display_name?.trim() || 'Dropbox'
}

function mapVault(entry: DropboxEntry): DropboxVaultFile | null {
  if (
    entry['.tag'] !== 'file'
    || !entry.name.toLowerCase().endsWith('.kdbx')
    || !entry.id
    || !entry.rev
    || typeof entry.size !== 'number'
    || !entry.server_modified
  ) return null

  return {
    id: entry.id,
    name: entry.name,
    pathDisplay: entry.path_display || `/${entry.name}`,
    rev: entry.rev,
    size: entry.size,
    serverModified: entry.server_modified,
  }
}

export async function listDropboxVaults(session: DropboxSession) {
  let page = await apiRequest<ListFolderResponse>(session.accessToken, 'files/list_folder', {
    path: '',
    recursive: true,
    include_deleted: false,
    include_non_downloadable_files: false,
  })
  const entries = [...page.entries]

  while (page.has_more) {
    page = await apiRequest<ListFolderResponse>(session.accessToken, 'files/list_folder/continue', {
      cursor: page.cursor,
    })
    entries.push(...page.entries)
  }

  return entries
    .map(mapVault)
    .filter((entry): entry is DropboxVaultFile => entry !== null)
    .sort((left, right) => left.name.localeCompare(right.name))
}

export async function downloadDropboxVault(session: DropboxSession, vault: DropboxVaultFile) {
  const response = await fetch(`${contentEndpoint}/files/download`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'Dropbox-API-Arg': JSON.stringify({ path: vault.id }),
    },
  })
  if (!response.ok) {
    throw new DropboxApiError(response.status === 401
      ? 'The Dropbox connection expired. Connect again.'
      : `${vault.name} could not be downloaded from Dropbox.`)
  }

  return new File([await response.arrayBuffer()], vault.name, { type: 'application/octet-stream' })
}
