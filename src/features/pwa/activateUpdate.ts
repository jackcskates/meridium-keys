type WaitingWorker = Pick<ServiceWorker, 'state' | 'postMessage' | 'addEventListener' | 'removeEventListener'>

export function activateWaitingUpdate(worker: WaitingWorker, timeoutMs = 10_000): Promise<void> {
  if (worker.state === 'redundant') return Promise.reject(new Error('The update was replaced. Check for updates again.'))
  if (worker.state === 'activated') return Promise.resolve()

  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      worker.removeEventListener('statechange', checkState)
      if (error) reject(error)
      else resolve()
    }
    const checkState = () => {
      if (worker.state === 'activated') finish()
      else if (worker.state === 'redundant') finish(new Error('The update was replaced. Check for updates again.'))
    }
    const timeout = setTimeout(() => finish(new Error('The update did not finish. Try again.')), timeoutMs)
    worker.addEventListener('statechange', checkState)
    try {
      worker.postMessage({ type: 'SKIP_WAITING' })
      checkState()
    } catch {
      finish(new Error('The update could not start. Try again.'))
    }
  })
}
