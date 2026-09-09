/// <reference lib="webworker" />

import { DOMParser as XmlDomParser, XMLSerializer as XmlSerializer } from '@xmldom/xmldom'
import { readKdbxSnapshot, VaultOpenError } from './kdbx'
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

function respond(message: VaultWorkerResponse) {
  scope.postMessage(message)
}

scope.onmessage = async (event: MessageEvent<VaultWorkerRequest>) => {
  if (event.data.type !== 'unlock') return

  try {
    respond({ type: 'progress', stage: 'reading' })
    const data = await event.data.file.arrayBuffer()
    respond({ type: 'progress', stage: 'decrypting' })
    const vault = await readKdbxSnapshot(data, event.data.password, event.data.file.name)
    respond({ type: 'progress', stage: 'mapping' })
    respond({ type: 'success', vault })
  } catch (error) {
    const safeError = error instanceof VaultOpenError
      ? error
      : new VaultOpenError('WORKER_FAILURE', 'The vault could not be opened. No vault data was retained.')
    respond({ type: 'error', code: safeError.code, message: safeError.message })
  }
}
