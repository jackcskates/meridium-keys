import { describe, expect, it } from 'vitest'
import { createSerialTaskQueue } from './serialTaskQueue'

describe('credential write ordering', () => {
  it('finishes a pending save before a later sign-out deletion', async () => {
    const enqueue = createSerialTaskQueue()
    const order: string[] = []
    let releaseSave!: () => void
    const saveGate = new Promise<void>((resolve) => { releaseSave = resolve })
    const save = enqueue(async () => { await saveGate; order.push('save') })
    const forget = enqueue(async () => { order.push('forget') })
    releaseSave()
    await Promise.all([save, forget])
    expect(order).toEqual(['save', 'forget'])
  })

  it('keeps accepting sign-out after a failed save', async () => {
    const enqueue = createSerialTaskQueue()
    await expect(enqueue(async () => { throw new Error('storage unavailable') })).rejects.toThrow('storage unavailable')
    await expect(enqueue(async () => 'forgotten')).resolves.toBe('forgotten')
  })
})
