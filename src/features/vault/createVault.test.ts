import { describe, expect, it } from 'vitest'
import { toVaultFileName } from './createVault'

describe('toVaultFileName', () => {
  it('adds one KDBX extension and preserves a readable name', () => {
    expect(toVaultFileName('Personal')).toBe('Personal.kdbx')
    expect(toVaultFileName('Personal.KDBX')).toBe('Personal.kdbx')
  })

  it('removes unsafe path characters', () => {
    expect(toVaultFileName('Work/Shared: Admin')).toBe('Work-Shared- Admin.kdbx')
  })

  it('rejects names that cannot produce a safe file name', () => {
    expect(() => toVaultFileName('...')).toThrow('letters or numbers')
  })
})
