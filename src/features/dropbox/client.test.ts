import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadDropboxVault, listDropboxVaults, loadDropboxAccount, uploadNewDropboxVault } from './client'
import type { DropboxSession, DropboxVaultFile } from './types'

const session: DropboxSession = {
  accessToken: 'test-access-token',
  expiresAt: Date.now() + 60_000,
  accountName: '',
}

afterEach(() => vi.unstubAllGlobals())

describe('Dropbox client', () => {
  it('lists only KDBX files across every Dropbox cursor page', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        entries: [
          { '.tag': 'folder', id: 'id:folder', name: 'Archive', path_display: '/Archive' },
          { '.tag': 'file', id: 'id:z', name: 'Zeta.kdbx', path_display: '/Zeta.kdbx', rev: '1', size: 2048, server_modified: '2026-09-09T00:00:00Z' },
        ],
        cursor: 'next-page',
        has_more: true,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        entries: [
          { '.tag': 'file', id: 'id:notes', name: 'notes.txt', path_display: '/notes.txt', rev: '2', size: 12, server_modified: '2026-09-09T00:00:00Z' },
          { '.tag': 'file', id: 'id:a', name: 'Alpha.KDBX', path_display: '/Alpha.KDBX', rev: '3', size: 4096, server_modified: '2026-09-09T00:00:00Z' },
        ],
        cursor: 'done',
        has_more: false,
      }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const vaults = await listDropboxVaults(session)

    expect(vaults.map((vault) => vault.name)).toEqual(['Alpha.KDBX', 'Zeta.kdbx'])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[1][0])).toContain('files/list_folder/continue')
  })

  it('loads the connected Dropbox display name', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      name: { display_name: 'Meridium Test' },
    }), { status: 200 })))

    await expect(loadDropboxAccount(session)).resolves.toBe('Meridium Test')
  })

  it('downloads a selected vault without changing its bytes', async () => {
    const bytes = new Uint8Array([3, 217, 162, 154])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(bytes, { status: 200 })))
    const vault: DropboxVaultFile = {
      id: 'id:vault',
      name: 'Personal.kdbx',
      pathDisplay: '/Personal.kdbx',
      rev: '4',
      size: bytes.length,
      serverModified: '2026-09-09T00:00:00Z',
    }

    const file = await downloadDropboxVault(session, vault)

    expect(file.name).toBe('Personal.kdbx')
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(bytes)
  })

  it('maps an expired Dropbox token to a reconnect message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })))

    await expect(listDropboxVaults(session)).rejects.toThrow('The Dropbox connection expired. Connect again.')
  })

  it('uploads a new vault without allowing overwrite or autorename', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'id:new',
      name: 'Personal.kdbx',
      path_display: '/Personal.kdbx',
      rev: 'new-rev',
      size: 1234,
      server_modified: '2026-09-09T00:00:00Z',
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const file = new File([new Uint8Array([1, 2, 3])], 'Personal.kdbx')
    const result = await uploadNewDropboxVault(session, file)
    const options = fetchMock.mock.calls[0][1] as RequestInit
    const headers = options.headers as Record<string, string>
    const argument = JSON.parse(headers['Dropbox-API-Arg'])

    expect(result.id).toBe('id:new')
    expect(argument).toMatchObject({ path: '/Personal.kdbx', mode: { '.tag': 'add' }, autorename: false, strict_conflict: true })
    expect(options.body).toBe(file)
  })

  it('recovers a saved vault by refreshing when upload metadata is incomplete', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ name: 'Personal.kdbx' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        entries: [{
          '.tag': 'file',
          id: 'id:recovered',
          name: 'Personal.kdbx',
          path_display: '/Personal.kdbx',
          rev: 'recovered-rev',
          size: 1234,
          server_modified: '2026-09-10T00:00:00Z',
        }],
        cursor: 'done',
        has_more: false,
      }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const file = new File([new Uint8Array([1, 2, 3])], 'Personal.kdbx')

    await expect(uploadNewDropboxVault(session, file)).resolves.toMatchObject({ id: 'id:recovered' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('reports a Dropbox name conflict without creating a copy', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('path/conflict/file', { status: 409 })))
    const file = new File([new Uint8Array([1])], 'Personal.kdbx')

    await expect(uploadNewDropboxVault(session, file)).rejects.toThrow('already exists')
  })
})
