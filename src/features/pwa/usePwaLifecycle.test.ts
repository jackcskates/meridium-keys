import { describe, expect, it } from 'vitest'
import { detectPwaEnvironment } from './usePwaLifecycle'

const desktop = {
  maxTouchPoints: 0,
  platform: 'MacIntel',
  standaloneDisplay: false,
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
}

describe('detectPwaEnvironment', () => {
  it('detects a normal desktop browser', () => {
    expect(detectPwaEnvironment(desktop)).toEqual({ isIos: false, isStandalone: false })
  })

  it('detects iPadOS when Safari presents a desktop user agent', () => {
    expect(detectPwaEnvironment({ ...desktop, maxTouchPoints: 5 })).toEqual({ isIos: true, isStandalone: false })
  })

  it('recognizes both standard and iOS standalone modes', () => {
    expect(detectPwaEnvironment({ ...desktop, standaloneDisplay: true }).isStandalone).toBe(true)
    expect(detectPwaEnvironment({ ...desktop, webkitStandalone: true }).isStandalone).toBe(true)
  })
})
