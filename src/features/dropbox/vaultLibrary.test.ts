import { describe, expect, it } from 'vitest'
import type { DropboxVaultFile } from './types'
import { filterVaults, removeVault, upsertVault } from './vaultLibrary'

const vault = (id: string, name: string, rev: string): DropboxVaultFile => ({
  id, name, rev, pathDisplay: `/${name}`, size: 100, serverModified: '2026-09-22T00:00:00Z',
})

describe('Dropbox vault library mutations', () => {
  it('replaces a saved vault revision without duplicating it', () => {
    const current = [vault('a', 'Alpha.kdbx', 'old'), vault('b', 'Beta.kdbx', 'one')]
    const updated = upsertVault(current, vault('a', 'Alpha.kdbx', 'new'))
    expect(updated).toHaveLength(2)
    expect(updated[0].rev).toBe('new')
    expect(current[0].rev).toBe('old')
  })

  it('keeps the library sorted when a vault is renamed or added', () => {
    const current = [vault('a', 'Alpha.kdbx', 'one'), vault('b', 'Beta.kdbx', 'one')]
    expect(upsertVault(current, vault('b', 'Aardvark.kdbx', 'two')).map((entry) => entry.id)).toEqual(['b', 'a'])
    expect(upsertVault(current, vault('c', 'Aardvark.kdbx', 'one')).map((entry) => entry.id)).toEqual(['c', 'a', 'b'])
  })

  it('removes only the deleted vault', () => {
    expect(removeVault([vault('a', 'Alpha.kdbx', 'one'), vault('b', 'Beta.kdbx', 'one')], 'a').map((entry) => entry.id)).toEqual(['b'])
  })

  it('finds existing Dropbox vaults by case-insensitive name without changing the library', () => {
    const current = [vault('a', 'Personal.kdbx', 'one'), vault('b', 'Development.kdbx', 'one')]
    expect(filterVaults(current, ' deveLOP ')).toEqual([current[1]])
    expect(filterVaults(current, 'missing')).toEqual([])
    expect(filterVaults(current, ' ')).toBe(current)
  })
})
