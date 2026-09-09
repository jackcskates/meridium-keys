import { VaultOpenError } from './kdbx'
import type { VaultSnapshot, VaultWorkerResponse } from './types'

export const maxVaultFileSize = 64 * 1024 * 1024

export type UnlockStage = 'reading' | 'decrypting' | 'mapping'

export function unlockVaultFile(
  file: File,
  password: string,
  onProgress?: (stage: UnlockStage) => void,
): Promise<VaultSnapshot> {
  if (!password) {
    return Promise.reject(new VaultOpenError('EMPTY_PASSWORD', 'Enter this vault’s master password.'))
  }

  if (file.size > maxVaultFileSize) {
    return Promise.reject(new VaultOpenError('FILE_TOO_LARGE', 'This vault is larger than the current 64 MB safety limit.'))
  }

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./kdbx.worker.ts', import.meta.url), { type: 'module' })
    const timeout = window.setTimeout(() => {
      worker.terminate()
      reject(new VaultOpenError('WORKER_FAILURE', 'Opening this vault took too long and was stopped safely.'))
    }, 120_000)

    function finish() {
      window.clearTimeout(timeout)
      worker.terminate()
    }

    worker.onmessage = (event: MessageEvent<VaultWorkerResponse>) => {
      const message = event.data
      if (message.type === 'progress') {
        onProgress?.(message.stage)
        return
      }

      finish()
      if (message.type === 'success') {
        resolve(message.vault)
      } else {
        reject(new VaultOpenError(message.code, message.message))
      }
    }

    worker.onerror = () => {
      finish()
      reject(new VaultOpenError('WORKER_FAILURE', 'The secure vault worker stopped unexpectedly.'))
    }

    worker.postMessage({ type: 'unlock', file, password })
  })
}
