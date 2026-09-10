import { describe, expect, it } from 'vitest'
import { DOMParser as XmlDomParser, XMLSerializer as XmlSerializer } from '@xmldom/xmldom'
import { Consts, Credentials, Kdbx, ProtectedValue } from 'kdbxweb'
import { configureArgon2, createKdbxData, loadKdbxDatabase, prepareKdbxEntryDelete, prepareKdbxEntryMove, prepareKdbxEntrySave, prepareKdbxGroupDelete, prepareKdbxGroupSave, readKdbxEntryDetails, readKdbxProtectedField, readKdbxSnapshot, VaultOpenError } from './kdbx'
import { createEmptyEntryDraft, entryTypeDefinitions } from './entryTypes'

// kdbxweb uses browser-native XML APIs in production. Supply the current,
// patched xmldom implementation only when these compatibility tests run in Node.
globalThis.DOMParser = XmlDomParser as unknown as typeof DOMParser
globalThis.XMLSerializer = XmlSerializer as unknown as typeof XMLSerializer

const fixturePassword = 'correct horse battery staple'
const fixtureSecret = 'fixture-secret-never-returned'

async function createFixture(kdf: string) {
  configureArgon2()
  const credentials = new Credentials(ProtectedValue.fromString(fixturePassword))
  const database = Kdbx.create(credentials, 'Compatibility Fixture')
  database.setKdf(kdf)
  const root = database.getDefaultGroup()
  const logins = database.createGroup(root, 'Logins')
  const entry = database.createEntry(logins)
  entry.fields.set('Title', 'Example Account')
  entry.fields.set('UserName', 'alice@example.test')
  entry.fields.set('URL', 'https://example.test')
  entry.fields.set('Password', ProtectedValue.fromString(fixtureSecret))
  return database.save()
}

describe('readKdbxSnapshot', () => {
  it('creates a standard empty KDBX 4 vault protected by Argon2id', async () => {
    const data = await createKdbxData('Created Fixture', fixturePassword)
    const result = await readKdbxSnapshot(data, fixturePassword, 'Created Fixture.kdbx')

    expect(result.databaseName).toBe('Created Fixture')
    expect(result.version).toMatch(/^4\./)
    expect(result.rootGroupId).toBeTruthy()
    expect(result.groups.some((group) => group.name === 'Created Fixture')).toBe(false)
    await expect(readKdbxSnapshot(data, 'wrong password')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
  })

  it('keeps vault master passwords byte-exact across punctuation, case, and spaces', async () => {
    const exactPassword = 'Moon$River.4!5 has spaces'
    const data = await createKdbxData('Exact Password Fixture', exactPassword)

    await expect(readKdbxSnapshot(data, exactPassword, 'exact-password.kdbx')).resolves.toMatchObject({
      databaseName: 'Exact Password Fixture',
    })
    await expect(readKdbxSnapshot(data, exactPassword.toLocaleLowerCase())).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
    await expect(readKdbxSnapshot(data, ` ${exactPassword} `)).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
  })

  it.each([
    ['KDBX 4 Argon2id', Consts.KdfId.Argon2id],
    ['KDBX 4 AES-KDF', Consts.KdfId.Aes],
  ])('opens a standard %s fixture without returning protected values', async (_label, kdf) => {
    const data = await createFixture(kdf)
    const result = await readKdbxSnapshot(data, fixturePassword, 'fixture.kdbx')

    expect(result.databaseName).toBe('Compatibility Fixture')
    expect(result.version).toMatch(/^4\./)
    expect(result.groups.some((group) => group.name === 'Logins')).toBe(true)
    expect(result.entries).toContainEqual(expect.objectContaining({
      title: 'Example Account',
      username: 'alice@example.test',
      url: 'https://example.test',
      hasPassword: true,
    }))
    expect(JSON.stringify(result)).not.toContain(fixtureSecret)
  })

  it('reports an incorrect master password without leaking the library error', async () => {
    const data = await createFixture(Consts.KdfId.Argon2id)

    await expect(readKdbxSnapshot(data, 'wrong password')).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: 'That master password did not unlock this vault.',
    } satisfies Partial<VaultOpenError>)
  })

  it('rejects non-KDBX bytes with a safe validation error', async () => {
    const data = new TextEncoder().encode('not a database').buffer

    await expect(readKdbxSnapshot(data, fixturePassword)).rejects.toMatchObject({
      code: 'NOT_KDBX',
    } satisfies Partial<VaultOpenError>)
  })

  it('requires a non-empty master password', async () => {
    await expect(readKdbxSnapshot(new ArrayBuffer(0), '')).rejects.toMatchObject({
      code: 'EMPTY_PASSWORD',
    } satisfies Partial<VaultOpenError>)
  })

  it('adds an encrypted entry and reopens it as a standard KDBX vault', async () => {
    const original = await createKdbxData('Editable Fixture', fixturePassword)
    const database = await loadKdbxDatabase(original, fixturePassword)
    const groupId = database.getDefaultGroup().uuid.toString()
    const prepared = await prepareKdbxEntrySave(database, {
      groupId,
      type: 'login',
      title: 'Meridium Account',
      fields: {
        username: 'jack@example.test',
        password: 'new-entry-secret',
        url: 'https://meridium.app',
        notes: 'Created in Meridium Keys',
      },
    }, 'Editable Fixture.kdbx')
    const reopened = await loadKdbxDatabase(prepared.data, fixturePassword)
    const summary = await readKdbxSnapshot(prepared.data, fixturePassword, 'Editable Fixture.kdbx')
    const entry = summary.entries.find((candidate) => candidate.title === 'Meridium Account')

    expect(entry).toBeDefined()
    expect(readKdbxEntryDetails(reopened, entry!.id)).toMatchObject({
      type: 'login',
      fields: expect.objectContaining({
        username: 'jack@example.test',
        password: 'new-entry-secret',
        url: 'https://meridium.app',
        notes: 'Created in Meridium Keys',
      }),
    })
    expect(new TextDecoder().decode(prepared.data)).not.toContain('new-entry-secret')
  })

  it('edits an existing entry while preserving KDBX history', async () => {
    const original = await createFixture(Consts.KdfId.Argon2id)
    const database = await loadKdbxDatabase(original, fixturePassword)
    const snapshot = await readKdbxSnapshot(original, fixturePassword)
    const existing = snapshot.entries[0]
    const prepared = await prepareKdbxEntrySave(database, {
      id: existing.id,
      groupId: existing.groupId,
      type: 'login',
      title: 'Updated Account',
      fields: {
        username: 'updated@example.test',
        password: 'updated-secret',
        url: 'https://updated.example.test',
        notes: 'Updated safely',
      },
    }, 'fixture.kdbx')
    const reopened = await loadKdbxDatabase(prepared.data, fixturePassword)
    const updated = readKdbxEntryDetails(reopened, existing.id)

    expect(updated).toMatchObject({ title: 'Updated Account', type: 'login', fields: expect.objectContaining({ password: 'updated-secret' }) })
    const reopenedEntry = [...reopened.getDefaultGroup().allEntries()].find((entry) => entry.uuid.toString() === existing.id)
    expect(reopenedEntry?.history).toHaveLength(1)
  })

  it('decrypts only a requested protected field for direct copy', async () => {
    const original = await createKdbxData('Protected Copy Fixture', fixturePassword)
    const database = await loadKdbxDatabase(original, fixturePassword)
    const groupId = database.getDefaultGroup().uuid.toString()
    const prepared = await prepareKdbxEntrySave(database, {
      groupId,
      type: 'api-key',
      title: 'Service API',
      fields: {
        service: 'Fixture Service',
        apiKey: 'fixture-api-key',
        apiSecret: 'fixture-api-secret',
        endpoint: 'https://api.example.test',
      },
    }, 'protected-copy.kdbx')
    const summary = prepared.vault.entries.find((entry) => entry.id === prepared.entryId)

    expect(summary?.protectedFieldKeys).toEqual(['apiKey', 'apiSecret'])
    expect(JSON.stringify(prepared.vault)).not.toContain('fixture-api-key')
    expect(JSON.stringify(prepared.vault)).not.toContain('fixture-api-secret')
    expect(readKdbxProtectedField(prepared.database, prepared.entryId, 'apiKey')).toBe('fixture-api-key')
    expect(readKdbxProtectedField(prepared.database, prepared.entryId, 'apiSecret')).toBe('fixture-api-secret')
    expect(() => readKdbxProtectedField(prepared.database, prepared.entryId, 'endpoint')).toThrow('not a protected value')
    expect(() => readKdbxProtectedField(prepared.database, prepared.entryId, 'missing')).toThrow('not a protected value')
  })

  it('deletes an entry into the standard KDBX recycle bin', async () => {
    const original = await createFixture(Consts.KdfId.Argon2id)
    const database = await loadKdbxDatabase(original, fixturePassword)
    const originalSnapshot = await readKdbxSnapshot(original, fixturePassword)
    const existing = originalSnapshot.entries[0]
    const prepared = await prepareKdbxEntryDelete(database, existing.id, 'fixture.kdbx')
    const reopened = await readKdbxSnapshot(prepared.data, fixturePassword, 'fixture.kdbx')
    const deleted = reopened.entries.find((entry) => entry.id === existing.id)

    expect(deleted).toMatchObject({ isDeleted: true })
    expect(reopened.entries.filter((entry) => !entry.isDeleted)).toHaveLength(0)
    expect(reopened.groups.some((group) => group.isRecycleBin)).toBe(true)
  })

  it('moves an entry between folders without exposing or changing its protected fields', async () => {
    const original = await createFixture(Consts.KdfId.Argon2id)
    const database = await loadKdbxDatabase(original, fixturePassword)
    const originalSnapshot = await readKdbxSnapshot(original, fixturePassword)
    const existing = originalSnapshot.entries[0]
    const created = await prepareKdbxGroupSave(database, { parentGroupId: originalSnapshot.rootGroupId, name: 'Archive' }, 'fixture.kdbx')
    const moved = await prepareKdbxEntryMove(created.database, existing.id, created.groupId, 'fixture.kdbx')
    const reopened = await loadKdbxDatabase(moved.data, fixturePassword)
    const movedSummary = moved.vault.entries.find((entry) => entry.id === existing.id)

    expect(movedSummary).toMatchObject({ groupId: created.groupId, title: 'Example Account', isDeleted: false })
    expect(readKdbxEntryDetails(reopened, existing.id)).toMatchObject({
      groupId: created.groupId,
      fields: expect.objectContaining({ password: fixtureSecret }),
    })
    expect(new TextDecoder().decode(moved.data)).not.toContain(fixtureSecret)
  })

  it('rejects an entry move into a folder inside the KDBX recycle bin', async () => {
    const original = await createFixture(Consts.KdfId.Argon2id)
    const database = await loadKdbxDatabase(original, fixturePassword)
    const originalSnapshot = await readKdbxSnapshot(original, fixturePassword)
    const existing = originalSnapshot.entries[0]
    const child = await prepareKdbxGroupSave(database, { parentGroupId: originalSnapshot.rootGroupId, name: 'Archived child' }, 'fixture.kdbx')
    const recycled = await prepareKdbxGroupDelete(child.database, child.groupId, 'fixture.kdbx')

    await expect(prepareKdbxEntryMove(recycled.database, existing.id, child.groupId, 'fixture.kdbx'))
      .rejects.toThrow('Entries cannot be dragged into the Recycle Bin.')
  })

  it('creates and renames a folder but requires it to be empty before deletion', async () => {
    const original = await createFixture(Consts.KdfId.Aes)
    let database = await loadKdbxDatabase(original, fixturePassword)
    const rootGroupId = database.getDefaultGroup().uuid.toString()
    const created = await prepareKdbxGroupSave(database, { parentGroupId: rootGroupId, name: 'Infrastructure' }, 'fixture.kdbx')
    database = created.database
    expect(created.vault.groups).toContainEqual(expect.objectContaining({ id: created.groupId, name: 'Infrastructure' }))

    const withEntry = await prepareKdbxEntrySave(database, {
      groupId: created.groupId,
      type: 'database',
      title: 'Production DB',
      fields: { database: 'main', host: 'db.example.test', username: 'admin', password: 'protected-db-secret' },
    }, 'fixture.kdbx')
    database = withEntry.database

    const renamed = await prepareKdbxGroupSave(database, { id: created.groupId, parentGroupId: rootGroupId, name: 'Systems' }, 'fixture.kdbx')
    expect(renamed.vault.groups).toContainEqual(expect.objectContaining({ id: created.groupId, name: 'Systems', entryCount: 1 }))

    await expect(prepareKdbxGroupDelete(renamed.database, created.groupId, 'fixture.kdbx'))
      .rejects.toThrow('Move or delete everything inside this folder before deleting it.')

    const emptied = await prepareKdbxEntryDelete(renamed.database, withEntry.entryId, 'fixture.kdbx')
    const deleted = await prepareKdbxGroupDelete(emptied.database, created.groupId, 'fixture.kdbx')
    const recycledGroup = deleted.vault.groups.find((group) => group.id === created.groupId)
    expect(recycledGroup).toMatchObject({ name: 'Systems', isRecycleBin: true, entryCount: 0 })
    expect(deleted.vault.entries.find((entry) => entry.title === 'Production DB')).toMatchObject({ isDeleted: true })
  })

  it('requires a folder to have no child folders before deletion', async () => {
    const original = await createFixture(Consts.KdfId.Aes)
    const database = await loadKdbxDatabase(original, fixturePassword)
    const rootGroupId = database.getDefaultGroup().uuid.toString()
    const parent = await prepareKdbxGroupSave(database, { parentGroupId: rootGroupId, name: 'Parent' }, 'fixture.kdbx')
    const child = await prepareKdbxGroupSave(parent.database, { parentGroupId: parent.groupId, name: 'Child' }, 'fixture.kdbx')

    await expect(prepareKdbxGroupDelete(child.database, parent.groupId, 'fixture.kdbx'))
      .rejects.toThrow('Move or delete everything inside this folder before deleting it.')
  })

  it('round-trips every Meridium entry type through standard KDBX fields', async () => {
    const original = await createFixture(Consts.KdfId.Aes)
    let database = await loadKdbxDatabase(original, fixturePassword)
    const rootGroupId = database.getDefaultGroup().uuid.toString()
    let lastData = original
    const protectedMarker = 'typed-secret-marker'

    for (const definition of entryTypeDefinitions) {
      const draft = createEmptyEntryDraft(definition.id, rootGroupId)
      draft.title = `${definition.label} Fixture`
      for (const field of definition.fields) {
        draft.fields[field.key] = field.kind === 'secret' || field.kind === 'secret-textarea'
          ? `${protectedMarker}-${definition.id}-${field.key}`
          : field.kind === 'url'
            ? 'https://example.test'
            : field.kind === 'email'
              ? 'owner@example.test'
              : field.kind === 'date'
                ? '2026-09-10'
                : `${definition.label} ${field.label}`
      }
      const prepared = await prepareKdbxEntrySave(database, draft, 'typed.kdbx')
      database = prepared.database
      lastData = prepared.data
    }

    const snapshot = await readKdbxSnapshot(lastData, fixturePassword, 'typed.kdbx')
    expect(new Set(snapshot.entries.map((entry) => entry.type))).toEqual(new Set(entryTypeDefinitions.map((definition) => definition.id)))
    for (const definition of entryTypeDefinitions) {
      const summary = snapshot.entries.find((entry) => entry.title === `${definition.label} Fixture`)
      expect(summary).toMatchObject({ type: definition.id, groupId: snapshot.rootGroupId })
      const details = readKdbxEntryDetails(database, summary!.id)
      expect(details.type).toBe(definition.id)
    }
    expect(new TextDecoder().decode(lastData)).not.toContain(protectedMarker)
  })
})
