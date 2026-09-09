import { VaultOpenError } from './kdbx'
import type { VaultWorkerResponse } from './types'

export type CreateVaultStage = 'creating' | 'encrypting'

export function toVaultFileName(vaultName: string) {
  const withoutExtension = vaultName.trim().replace(/\.kdbx$/i, '')
  // oxlint-disable-next-line no-control-regex -- Control characters are invalid in portable file names.
  const invalidFileNameCharacters = /[\\/:*?"<>|\u0000-\u001f]/g
  const safeName = withoutExtension
    .replace(invalidFileNameCharacters, '-')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .slice(0, 80)
    .trim()

  if (!safeName) throw new Error('Enter a vault name containing letters or numbers.')
  return `${safeName}.kdbx`
}

export function createVaultFile(
  vaultName: string,
  password: string,
  onProgress?: (stage: CreateVaultStage) => void,
): Promise<File> {
  if (!password) return Promise.reject(new VaultOpenError('EMPTY_PASSWORD', 'Enter a master password for this vault.'))

  const fileName = toVaultFileName(vaultName)
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./kdbx.worker.ts', import.meta.url), { type: 'module' })
    const timeout = window.setTimeout(() => {
      worker.terminate()
      reject(new VaultOpenError('WORKER_FAILURE', 'Creating this vault took too long and was stopped safely.'))
    }, 120_000)

    function finish() {
      window.clearTimeout(timeout)
      worker.terminate()
    }

    worker.onmessage = (event: MessageEvent<VaultWorkerResponse>) => {
      const message = event.data
      if (message.type === 'progress') {
        if (message.stage === 'creating' || message.stage === 'encrypting') onProgress?.(message.stage)
        return
      }

      finish()
      if (message.type === 'created') {
        resolve(new File([message.data], message.fileName, { type: 'application/octet-stream' }))
      } else if (message.type === 'error') {
        reject(new VaultOpenError(message.code, message.message))
      } else {
        reject(new VaultOpenError('WORKER_FAILURE', 'The secure vault worker returned an unexpected result.'))
      }
    }

    worker.onerror = () => {
      finish()
      reject(new VaultOpenError('WORKER_FAILURE', 'The secure vault worker stopped unexpectedly.'))
    }

    worker.postMessage({ type: 'create', databaseName: vaultName.trim(), fileName, password })
  })
}
