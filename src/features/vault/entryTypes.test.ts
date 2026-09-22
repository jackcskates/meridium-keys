import { describe, expect, it } from 'vitest'
import { changeEntryDraftType, createEmptyEntryDraft, entryTypeConflicts, missingRequiredEntryFields } from './entryTypes'

describe('entry type conversion', () => {
  it('moves shared Login values into Password format without dropping source fields', () => {
    const login = createEmptyEntryDraft('login', 'group-id')
    login.title = 'Converted entry'
    login.fields = {
      username: 'owner@example.test',
      password: 'fixture-secret',
      url: 'https://example.test',
      notes: 'Keep this note',
    }

    const password = changeEntryDraftType(login, 'password')

    expect(password).toMatchObject({ type: 'password', title: 'Converted entry', groupId: 'group-id' })
    expect(password.fields).toMatchObject({
      username: 'owner@example.test',
      password: 'fixture-secret',
      url: 'https://example.test',
      notes: 'Keep this note',
    })
    expect(entryTypeConflicts(login, 'password').map(({ field }) => field.key)).toEqual(['username'])
    expect(missingRequiredEntryFields(password)).toEqual([])
  })

  it('identifies required fields missing from the destination format', () => {
    const login = createEmptyEntryDraft('login', 'group-id')
    const password = changeEntryDraftType(login, 'password')
    expect(missingRequiredEntryFields(password).map((field) => field.key)).toEqual(['password'])
  })
})
