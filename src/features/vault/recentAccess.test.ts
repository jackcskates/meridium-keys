import { describe, expect, it } from 'vitest'
import { rememberRecentAccess, resolveRecentAccess } from './recentAccess'
import type { VaultSnapshot } from './types'

const vault: VaultSnapshot = {
  fileName: 'Personal.kdbx', databaseName: 'Personal', version: '4.0', rootGroupId: 'root',
  groups: [
    { id: 'work', parentGroupId: 'root', name: 'Work', path: 'Work', depth: 0, entryCount: 1, isRecycleBin: false },
    { id: 'trash', parentGroupId: 'root', name: 'Recycle Bin', path: 'Recycle Bin', depth: 0, entryCount: 1, isRecycleBin: true },
  ],
  entries: [
    { id: 'key', groupId: 'work', type: 'login', title: 'Example', username: '', url: '', subtitle: '', hasPassword: true, protectedFieldKeys: ['password'], icon: null, isDeleted: false },
    { id: 'deleted', groupId: 'trash', type: 'note', title: 'Old note', username: '', url: '', subtitle: '', hasPassword: false, protectedFieldKeys: [], icon: null, isDeleted: true },
  ],
}

describe('in-memory recent vault shortcuts', () => {
  it('moves revisited items to the front without mixing keys and folders', () => {
    let history = rememberRecentAccess(undefined, { kind: 'entry', id: 'a' })
    history = rememberRecentAccess(history, { kind: 'folder', id: 'work' })
    history = rememberRecentAccess(history, { kind: 'entry', id: 'b' })
    history = rememberRecentAccess(history, { kind: 'entry', id: 'a' })
    expect(history).toEqual({ entries: ['a', 'b'], folders: ['work'] })
  })

  it('limits each kind independently', () => {
    let history = rememberRecentAccess(undefined, { kind: 'folder', id: 'work' })
    for (const id of ['a', 'b', 'c', 'd', 'e']) history = rememberRecentAccess(history, { kind: 'entry', id })
    expect(history).toEqual({ entries: ['e', 'd', 'c', 'b'], folders: ['work'] })
  })

  it('resolves names only from the currently unlocked snapshot and skips deleted items', () => {
    const shortcuts = resolveRecentAccess(vault, { entries: ['key', 'deleted', 'missing'], folders: ['work', 'trash', 'missing'] })
    expect(shortcuts.entries).toEqual([{ target: { kind: 'entry', id: 'key' }, title: 'Example', subtitle: 'Work', type: 'login' }])
    expect(shortcuts.folders).toEqual([{ target: { kind: 'folder', id: 'work' }, title: 'Work', subtitle: '1 key' }])
    expect(resolveRecentAccess(vault, undefined)).toEqual({ entries: [], folders: [] })
  })
})
