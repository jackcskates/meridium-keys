import { afterEach, describe, expect, it, vi } from 'vitest'
import { activateWaitingUpdate } from './activateUpdate'

function waitingWorker(initialState: ServiceWorkerState = 'installed') {
  const events = new EventTarget()
  let state = initialState
  const worker = {
    get state() { return state },
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    postMessage: vi.fn(),
  }
  return {
    worker,
    changeState(next: ServiceWorkerState) {
      state = next
      events.dispatchEvent(new Event('statechange'))
    },
  }
}

afterEach(() => vi.useRealTimers())

describe('activateWaitingUpdate', () => {
  it('asks the waiting worker to activate and resolves only after activation', async () => {
    const { worker, changeState } = waitingWorker()
    const result = activateWaitingUpdate(worker)
    expect(worker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
    changeState('activating')
    changeState('activated')
    await expect(result).resolves.toBeUndefined()
  })

  it('reports a worker replaced before activation', async () => {
    const { worker, changeState } = waitingWorker()
    const result = activateWaitingUpdate(worker)
    changeState('redundant')
    await expect(result).rejects.toThrow('replaced')
  })

  it('reports an activation timeout instead of silently doing nothing', async () => {
    vi.useFakeTimers()
    const { worker } = waitingWorker()
    const result = activateWaitingUpdate(worker, 100)
    const assertion = expect(result).rejects.toThrow('did not finish')
    await vi.advanceTimersByTimeAsync(100)
    await assertion
  })
})
