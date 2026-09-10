import { VaultOpenError } from './kdbx'
import type { VaultEntryDetails, VaultEntryDraft, VaultGroupDraft, VaultSnapshot, VaultWorkerRequest, VaultWorkerResponse } from './types'

export const maxVaultFileSize = 64 * 1024 * 1024

export type UnlockStage = 'reading' | 'decrypting' | 'mapping'

type PendingRequest = {
  resolve: (message: VaultWorkerResponse) => void
  reject: (error: Error) => void
  timeout: number
}

export type PreparedVaultChange = {
  changeId: string
  data: ArrayBuffer
  entryId?: string
  groupId?: string
  vault: VaultSnapshot
}

export class UnlockedVaultSession {
  private readonly pending = new Map<string, PendingRequest>()
  private readonly worker: Worker
  private closed = false

  constructor(worker: Worker) {
    this.worker = worker
    worker.onmessage = (event: MessageEvent<VaultWorkerResponse>) => {
      const message = event.data
      if (!('requestId' in message) || !message.requestId) return
      const pending = this.pending.get(message.requestId)
      if (!pending) return
      window.clearTimeout(pending.timeout)
      this.pending.delete(message.requestId)
      if (message.type === 'error') pending.reject(new VaultOpenError(message.code, message.message))
      else pending.resolve(message)
    }
    worker.onerror = () => this.failAll('The secure vault worker stopped unexpectedly.')
  }

  private failAll(message: string) {
    for (const pending of this.pending.values()) {
      window.clearTimeout(pending.timeout)
      pending.reject(new VaultOpenError('WORKER_FAILURE', message))
    }
    this.pending.clear()
    this.close()
  }

  private request(createRequest: (requestId: string) => VaultWorkerRequest) {
    if (this.closed) return Promise.reject(new VaultOpenError('WORKER_FAILURE', 'The vault is locked. Open it again before making changes.'))
    const requestId = crypto.randomUUID()
    return new Promise<VaultWorkerResponse>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        this.pending.delete(requestId)
        reject(new VaultOpenError('WORKER_FAILURE', 'The vault operation took too long and was stopped safely.'))
      }, 120_000)
      this.pending.set(requestId, { resolve, reject, timeout })
      this.worker.postMessage(createRequest(requestId))
    })
  }

  async getEntry(entryId: string): Promise<VaultEntryDetails> {
    const message = await this.request((requestId) => ({ type: 'get-entry', entryId, requestId }))
    if (message.type !== 'entry') throw new VaultOpenError('WORKER_FAILURE', 'The secure vault worker returned an unexpected entry response.')
    return message.entry
  }

  async prepareEntrySave(entry: VaultEntryDraft): Promise<PreparedVaultChange> {
    const message = await this.request((requestId) => ({ type: 'prepare-entry-save', entry, requestId }))
    if (message.type !== 'change-prepared') throw new VaultOpenError('WORKER_FAILURE', 'The secure vault worker returned an unexpected save response.')
    return { changeId: message.changeId, data: message.data, entryId: message.entryId, vault: message.vault }
  }

  async prepareEntryDelete(entryId: string): Promise<PreparedVaultChange> {
    const message = await this.request((requestId) => ({ type: 'prepare-entry-delete', entryId, requestId }))
    if (message.type !== 'change-prepared') throw new VaultOpenError('WORKER_FAILURE', 'The secure vault worker returned an unexpected delete response.')
    return { changeId: message.changeId, data: message.data, vault: message.vault }
  }

  async prepareGroupSave(group: VaultGroupDraft): Promise<PreparedVaultChange> {
    const message = await this.request((requestId) => ({ type: 'prepare-group-save', group, requestId }))
    if (message.type !== 'change-prepared') throw new VaultOpenError('WORKER_FAILURE', 'The secure vault worker returned an unexpected folder response.')
    return { changeId: message.changeId, data: message.data, groupId: message.groupId, vault: message.vault }
  }

  async prepareGroupDelete(groupId: string): Promise<PreparedVaultChange> {
    const message = await this.request((requestId) => ({ type: 'prepare-group-delete', groupId, requestId }))
    if (message.type !== 'change-prepared') throw new VaultOpenError('WORKER_FAILURE', 'The secure vault worker returned an unexpected folder delete response.')
    return { changeId: message.changeId, data: message.data, vault: message.vault }
  }

  async finishChange(changeId: string, commit: boolean) {
    const message = await this.request((requestId) => ({ type: 'finish-change', changeId, commit, requestId }))
    if (message.type !== 'change-finished') throw new VaultOpenError('WORKER_FAILURE', 'The secure vault worker could not finish the save.')
    return message.vault
  }

  close() {
    if (this.closed) return
    this.closed = true
    this.worker.terminate()
    for (const pending of this.pending.values()) {
      window.clearTimeout(pending.timeout)
      pending.reject(new VaultOpenError('WORKER_FAILURE', 'The vault was locked before the operation finished.'))
    }
    this.pending.clear()
  }
}

export function openVaultSession(
  file: File,
  password: string,
  onProgress?: (stage: UnlockStage) => void,
): Promise<{ session: UnlockedVaultSession; vault: VaultSnapshot }> {
  if (!password) return Promise.reject(new VaultOpenError('EMPTY_PASSWORD', 'Enter this vault’s master password.'))
  if (file.size > maxVaultFileSize) return Promise.reject(new VaultOpenError('FILE_TOO_LARGE', 'This vault is larger than the current 64 MB safety limit.'))

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./kdbx.worker.ts', import.meta.url), { type: 'module' })
    const timeout = window.setTimeout(() => {
      worker.terminate()
      reject(new VaultOpenError('WORKER_FAILURE', 'Opening this vault took too long and was stopped safely.'))
    }, 120_000)

    function fail(error: Error) {
      window.clearTimeout(timeout)
      worker.terminate()
      reject(error)
    }

    worker.onmessage = (event: MessageEvent<VaultWorkerResponse>) => {
      const message = event.data
      if (message.type === 'progress') {
        if (message.stage === 'reading' || message.stage === 'decrypting' || message.stage === 'mapping') onProgress?.(message.stage)
        return
      }
      if (message.type === 'success') {
        window.clearTimeout(timeout)
        resolve({ session: new UnlockedVaultSession(worker), vault: message.vault })
      } else if (message.type === 'error') {
        fail(new VaultOpenError(message.code, message.message))
      } else {
        fail(new VaultOpenError('WORKER_FAILURE', 'The secure vault worker returned an unexpected result.'))
      }
    }
    worker.onerror = () => fail(new VaultOpenError('WORKER_FAILURE', 'The secure vault worker stopped unexpectedly.'))
    worker.postMessage({ type: 'unlock', file, password })
  })
}

export async function unlockVaultFile(
  file: File,
  password: string,
  onProgress?: (stage: UnlockStage) => void,
) {
  const opened = await openVaultSession(file, password, onProgress)
  opened.session.close()
  return opened.vault
}
