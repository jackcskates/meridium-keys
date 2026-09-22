import { describe, expect, it } from 'vitest'
import { DOMParser as XmlDomParser, XMLSerializer as XmlSerializer } from '@xmldom/xmldom'
import { Consts, Credentials, Kdbx, KdbxBinaries, KdbxUuid, ProtectedValue } from 'kdbxweb'
import { configureArgon2, createKdbxData, exportKdbxEntriesTransfer, exportKdbxEntryTransfer, loadKdbxDatabase, prepareKdbxEntriesDelete, prepareKdbxEntriesImport, prepareKdbxEntriesMove, prepareKdbxEntriesPermanentDelete, prepareKdbxEntriesTypeChange, prepareKdbxEntryDelete, prepareKdbxEntryImport, prepareKdbxEntryMove, prepareKdbxEntrySave, prepareKdbxGroupDelete, prepareKdbxGroupSave, prepareKdbxVaultRename, readKdbxEntryDetails, readKdbxProtectedField, readKdbxSnapshot, VaultOpenError } from './kdbx'
import { changeEntryDraftType, createEmptyEntryDraft, entryTypeDefinitions } from './entryTypes'

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

  it('changes one or more entry types while preserving fields outside the new format', async () => {
    const original = await createKdbxData('Type Change Fixture', fixturePassword)
    let database = await loadKdbxDatabase(original, fixturePassword)
    const groupId = database.getDefaultGroup().uuid.toString()
    const entryIds: string[] = []
    for (const title of ['First Login', 'Second Login']) {
      const prepared = await prepareKdbxEntrySave(database, {
        groupId,
        type: 'login',
        title,
        fields: {
          username: `${title.toLowerCase().replace(' ', '.')}@example.test`,
          password: `${title}-secret`,
          url: 'https://example.test',
          notes: 'Preserve every shared field',
        },
      }, 'type-change.kdbx')
      database = prepared.database
      entryIds.push(prepared.entryId)
    }

    const changed = await prepareKdbxEntriesTypeChange(database, entryIds, 'password', 'type-change.kdbx')
    const reopened = await loadKdbxDatabase(changed.data, fixturePassword)

    for (const entryId of entryIds) {
      const details = readKdbxEntryDetails(reopened, entryId)
      expect(details.type).toBe('password')
      expect(details.fields.password).toContain('Login-secret')
      expect(details.fields.username).toContain('@example.test')
      const kdbxEntry = [...reopened.getDefaultGroup().allEntries()].find((entry) => entry.uuid.toString() === entryId)
      expect(kdbxEntry?.history).toHaveLength(1)
    }

    const restored = await prepareKdbxEntriesTypeChange(reopened, entryIds, 'login', 'type-change.kdbx')
    const restoredDatabase = await loadKdbxDatabase(restored.data, fixturePassword)
    expect(entryIds.map((entryId) => readKdbxEntryDetails(restoredDatabase, entryId).fields.username)).toEqual([
      'first.login@example.test',
      'second.login@example.test',
    ])
  })

  it('does not change an entry to a format when a required destination field is empty', async () => {
    const original = await createKdbxData('Required Type Fixture', fixturePassword)
    const database = await loadKdbxDatabase(original, fixturePassword)
    const created = await prepareKdbxEntrySave(database, {
      groupId: database.getDefaultGroup().uuid.toString(),
      type: 'login',
      title: 'Passwordless Login',
      fields: { username: 'owner@example.test', password: '', url: '', notes: '' },
    }, 'required-type.kdbx')

    await expect(prepareKdbxEntriesTypeChange(created.database, [created.entryId], 'password', 'required-type.kdbx'))
      .rejects.toThrow('needs password before it can become Password')
  })

  it('applies an explicit conflict resolution without removing destination fields', async () => {
    const original = await createKdbxData('Resolved Type Fixture', fixturePassword)
    const database = await loadKdbxDatabase(original, fixturePassword)
    const created = await prepareKdbxEntrySave(database, {
      groupId: database.getDefaultGroup().uuid.toString(),
      type: 'login',
      title: 'Resolved Login',
      fields: { username: 'remove-me@example.test', password: 'keep-this-secret', url: 'https://example.test', notes: '' },
    }, 'resolved-type.kdbx')
    const details = readKdbxEntryDetails(created.database, created.entryId)
    const converted = changeEntryDraftType(details, 'password')
    const resolved = await prepareKdbxEntrySave(created.database, { ...converted, removedFieldKeys: ['username', 'password'] }, 'resolved-type.kdbx')
    const reopened = await loadKdbxDatabase(resolved.data, fixturePassword)
    const reopenedDetails = readKdbxEntryDetails(reopened, created.entryId)

    expect(reopenedDetails.type).toBe('password')
    expect(reopenedDetails.fields.username).toBe('')
    expect(reopenedDetails.fields.password).toBe('keep-this-secret')
  })

  it('copies a complete entry into another vault root with protected custom fields and attachments', async () => {
    const sourceData = await createKdbxData('Transfer Source', fixturePassword)
    const source = await loadKdbxDatabase(sourceData, fixturePassword)
    const created = await prepareKdbxEntrySave(source, {
      groupId: source.getDefaultGroup().uuid.toString(),
      type: 'login',
      title: 'Transferred Login',
      fields: { username: 'person@example.test', password: 'source-secret', url: 'https://example.test', notes: 'transfer note' },
    }, 'source.kdbx')
    const sourceEntry = [...created.database.getDefaultGroup().allEntries()].find((entry) => entry.uuid.toString() === created.entryId)
    expect(sourceEntry).toBeDefined()
    sourceEntry!.fields.set('Legacy Secret', ProtectedValue.fromString('legacy-value'))
    const attachmentBytes = new TextEncoder().encode('attachment contents').buffer as ArrayBuffer
    sourceEntry!.binaries.set('reference.txt', await created.database.binaries.add(attachmentBytes))
    sourceEntry!.autoType.defaultSequence = '{USERNAME}{TAB}{PASSWORD}{ENTER}'
    sourceEntry!.customData = new Map([['migration-label', { value: 'legacy import' }]])
    const customIconId = KdbxUuid.random()
    created.database.meta.customIcons.set(customIconId.toString(), { data: new Uint8Array([1, 2, 3, 4]).buffer as ArrayBuffer, name: 'Imported icon' })
    sourceEntry!.customIcon = customIconId

    const transfer = exportKdbxEntryTransfer(created.database, created.entryId)
    const destinationData = await createKdbxData('Transfer Destination', fixturePassword)
    const destination = await loadKdbxDatabase(destinationData, fixturePassword)
    const imported = await prepareKdbxEntryImport(destination, transfer, 'destination.kdbx')
    const reopened = await loadKdbxDatabase(imported.data, fixturePassword)
    const importedEntry = [...reopened.getDefaultGroup().allEntries()].find((entry) => entry.uuid.toString() === imported.entryId)
    const customSecret = importedEntry?.fields.get('Legacy Secret')
    const attachment = importedEntry?.binaries.get('reference.txt')
    const attachmentValue = KdbxBinaries.isKdbxBinaryWithHash(attachment) ? attachment.value : attachment
    const importedIcon = importedEntry?.customIcon ? reopened.meta.customIcons.get(importedEntry.customIcon.toString()) : undefined

    expect(importedEntry?.parentGroup?.uuid.toString()).toBe(reopened.getDefaultGroup().uuid.toString())
    expect(importedEntry?.fields.get('Title')).toBe('Transferred Login')
    expect(customSecret).toBeInstanceOf(ProtectedValue)
    expect((customSecret as ProtectedValue).getText()).toBe('legacy-value')
    expect(new TextDecoder().decode(attachmentValue instanceof ProtectedValue ? attachmentValue.getBinary() : attachmentValue)).toBe('attachment contents')
    expect(importedEntry?.autoType.defaultSequence).toBe('{USERNAME}{TAB}{PASSWORD}{ENTER}')
    expect(importedEntry?.customData?.get('migration-label')?.value).toBe('legacy import')
    expect([...new Uint8Array(importedIcon?.data || new ArrayBuffer(0))]).toEqual([1, 2, 3, 4])
  })

  it('moves, transfers, and recycles a selected batch in one encrypted change per vault', async () => {
    const sourceData = await createKdbxData('Batch Source', fixturePassword)
    let source = await loadKdbxDatabase(sourceData, fixturePassword)
    const rootGroupId = source.getDefaultGroup().uuid.toString()
    const first = await prepareKdbxEntrySave(source, {
      groupId: rootGroupId,
      type: 'password',
      title: 'Batch Password',
      fields: { password: 'batch-password-secret', url: 'https://one.example.test' },
    }, 'batch-source.kdbx')
    source = first.database
    const second = await prepareKdbxEntrySave(source, {
      groupId: rootGroupId,
      type: 'note',
      title: 'Batch Note',
      fields: { notes: 'move this note too' },
    }, 'batch-source.kdbx')
    const folder = await prepareKdbxGroupSave(second.database, { parentGroupId: rootGroupId, name: 'Migrating' }, 'batch-source.kdbx')
    const entryIds = [first.entryId, second.entryId]

    const moved = await prepareKdbxEntriesMove(folder.database, entryIds, folder.groupId, 'batch-source.kdbx')
    expect(moved.vault.entries.filter((entry) => entryIds.includes(entry.id))).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: 'Batch Password', groupId: folder.groupId }),
      expect.objectContaining({ title: 'Batch Note', groupId: folder.groupId }),
    ]))

    const transfers = exportKdbxEntriesTransfer(moved.database, entryIds)
    const destinationData = await createKdbxData('Batch Destination', fixturePassword)
    const destination = await loadKdbxDatabase(destinationData, fixturePassword)
    const imported = await prepareKdbxEntriesImport(destination, transfers, 'batch-destination.kdbx')
    const importedSnapshot = await readKdbxSnapshot(imported.data, fixturePassword, 'batch-destination.kdbx')
    expect(importedSnapshot.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: 'Batch Password', groupId: importedSnapshot.rootGroupId }),
      expect.objectContaining({ title: 'Batch Note', groupId: importedSnapshot.rootGroupId }),
    ]))

    const recycled = await prepareKdbxEntriesDelete(moved.database, entryIds, 'batch-source.kdbx')
    expect(recycled.vault.entries.filter((entry) => entryIds.includes(entry.id))).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: 'Batch Password', isDeleted: true }),
      expect.objectContaining({ title: 'Batch Note', isDeleted: true }),
    ]))
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

  it('permanently deletes multiple selected entries in one encrypted change', async () => {
    const original = await createFixture(Consts.KdfId.Argon2id)
    let database = await loadKdbxDatabase(original, fixturePassword)
    const initial = await readKdbxSnapshot(original, fixturePassword)
    const retained = await prepareKdbxEntrySave(database, {
      groupId: initial.entries[0].groupId,
      type: 'login',
      title: 'Keep This Entry',
      fields: { username: 'keep@example.test', password: 'keep-secret' },
    }, 'fixture.kdbx')
    database = retained.database
    const removed = await prepareKdbxEntrySave(database, {
      groupId: initial.entries[0].groupId,
      type: 'note',
      title: 'Delete This Entry',
      fields: { notes: 'temporary note' },
    }, 'fixture.kdbx')

    const prepared = await prepareKdbxEntriesPermanentDelete(removed.database, [initial.entries[0].id, removed.entryId], 'fixture.kdbx')
    const reopened = await loadKdbxDatabase(prepared.data, fixturePassword)
    const snapshot = await readKdbxSnapshot(prepared.data, fixturePassword, 'fixture.kdbx')

    expect(snapshot.entries.map((entry) => entry.title)).toEqual(['Keep This Entry'])
    expect(snapshot.entries.some((entry) => entry.isDeleted)).toBe(false)
    expect(reopened.deletedObjects.map((item) => item.uuid?.toString())).toEqual(expect.arrayContaining([initial.entries[0].id, removed.entryId]))
  })

  it('renames the KDBX metadata without changing its entries or credentials', async () => {
    const original = await createFixture(Consts.KdfId.Aes)
    const database = await loadKdbxDatabase(original, fixturePassword)
    const prepared = await prepareKdbxVaultRename(database, 'Imported Passwords', 'Imported Passwords.kdbx')
    const reopened = await readKdbxSnapshot(prepared.data, fixturePassword, 'Imported Passwords.kdbx')

    expect(reopened).toMatchObject({ databaseName: 'Imported Passwords', fileName: 'Imported Passwords.kdbx' })
    expect(reopened.entries).toContainEqual(expect.objectContaining({ title: 'Example Account' }))
    await expect(readKdbxSnapshot(prepared.data, 'wrong password')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
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
