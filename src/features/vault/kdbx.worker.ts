/// <reference lib="webworker" />

import { DOMParser as XmlDomParser, XMLSerializer as XmlSerializer } from '@xmldom/xmldom'
import type { Kdbx } from 'kdbxweb'
import { createKdbxData, loadKdbxDatabase, mapKdbxSnapshot, prepareKdbxEntryDelete, prepareKdbxEntrySave, readKdbxEntryDetails, VaultOpenError } from './kdbx'
import type { VaultWorkerRequest, VaultWorkerResponse } from './types'

const scope = self as DedicatedWorkerGlobalScope
const scopeWithXml = scope as DedicatedWorkerGlobalScope & {
  DOMParser: typeof DOMParser
  XMLSerializer: typeof XMLSerializer
}

// DOMParser is unavailable in web workers. kdbxweb detects these globals and
// uses this patched XML implementation for its in-worker KDBX document model.
scopeWithXml.DOMParser = XmlDomParser as unknown as typeof DOMParser
scopeWithXml.XMLSerializer = XmlSerializer as unknown as typeof XMLSerializer

let database: Kdbx | null = null
let fileName = ''
let pendingChange: { id: string; database: Kdbx } | null = null

function respond(message: VaultWorkerResponse) {
  scope.postMessage(message)
}

scope.onmessage = async (event: MessageEvent<VaultWorkerRequest>) => {
  const requestId = 'requestId' in event.data ? event.data.requestId : undefined
  try {
    if (event.data.type === 'create') {
      respond({ type: 'progress', stage: 'creating' })
      respond({ type: 'progress', stage: 'encrypting' })
      const data = await createKdbxData(event.data.databaseName, event.data.password)
      scope.postMessage({ type: 'created', data, fileName: event.data.fileName } satisfies VaultWorkerResponse, [data])
      return
    }

    if (event.data.type === 'unlock') {
      respond({ type: 'progress', stage: 'reading' })
      const data = await event.data.file.arrayBuffer()
      respond({ type: 'progress', stage: 'decrypting' })
      database = await loadKdbxDatabase(data, event.data.password)
      fileName = event.data.file.name
      pendingChange = null
      respond({ type: 'progress', stage: 'mapping' })
      respond({ type: 'success', vault: mapKdbxSnapshot(database, fileName) })
      return
    }

    if (!database) throw new VaultOpenError('WORKER_FAILURE', 'The vault is locked. Open it again before making changes.')

    if (event.data.type === 'get-entry') {
      respond({ type: 'entry', entry: readKdbxEntryDetails(database, event.data.entryId), requestId: event.data.requestId })
      return
    }

    if (event.data.type === 'prepare-entry-save') {
      if (pendingChange) throw new VaultOpenError('WORKER_FAILURE', 'Finish the current save before changing another entry.')
      const prepared = await prepareKdbxEntrySave(database, event.data.entry, fileName)
      const changeId = crypto.randomUUID()
      pendingChange = { id: changeId, database: prepared.database }
      scope.postMessage({
        type: 'entry-save-prepared',
        changeId,
        data: prepared.data,
        entryId: prepared.entryId,
        requestId: event.data.requestId,
        vault: prepared.vault,
      } satisfies VaultWorkerResponse, [prepared.data])
      return
    }

    if (event.data.type === 'prepare-entry-delete') {
      if (pendingChange) throw new VaultOpenError('WORKER_FAILURE', 'Finish the current save before deleting another entry.')
      const prepared = await prepareKdbxEntryDelete(database, event.data.entryId, fileName)
      const changeId = crypto.randomUUID()
      pendingChange = { id: changeId, database: prepared.database }
      scope.postMessage({
        type: 'entry-save-prepared',
        changeId,
        data: prepared.data,
        requestId: event.data.requestId,
        vault: prepared.vault,
      } satisfies VaultWorkerResponse, [prepared.data])
      return
    }

    if (!pendingChange || pendingChange.id !== event.data.changeId) {
      throw new VaultOpenError('WORKER_FAILURE', 'The prepared vault change is no longer available.')
    }
    if (event.data.commit) database = pendingChange.database
    pendingChange = null
    respond({ type: 'entry-save-finished', requestId: event.data.requestId, vault: mapKdbxSnapshot(database, fileName) })
  } catch (error) {
    const safeError = error instanceof VaultOpenError
      ? error
      : new VaultOpenError('WORKER_FAILURE', 'The vault operation could not be completed safely. No vault data was retained.')
    respond({ type: 'error', code: safeError.code, message: safeError.message, requestId })
  }
}
