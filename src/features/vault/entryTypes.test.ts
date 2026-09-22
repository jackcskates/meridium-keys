import { describe, expect, it } from 'vitest'
import { createEmptyEntryDraft, entryMatchesKeyword } from './entryTypes'

describe('entry types', () => {
  it('creates a blank draft for the chosen entry type', () => {
    expect(createEmptyEntryDraft('password', 'group-id')).toMatchObject({
      groupId: 'group-id',
      type: 'password',
      title: '',
      fields: { password: '', url: '', notes: '' },
    })
  })

  it('filters entry summaries by title, subtitle, or type label', () => {
    const entry = { id: 'entry-id', groupId: 'group-id', title: 'Production Token', subtitle: 'api.example.test', type: 'api-key' as const, isDeleted: false }
    expect(entryMatchesKeyword(entry, 'production')).toBe(true)
    expect(entryMatchesKeyword(entry, 'EXAMPLE')).toBe(true)
    expect(entryMatchesKeyword(entry, 'api key')).toBe(true)
    expect(entryMatchesKeyword(entry, 'database')).toBe(false)
  })
})
