import { describe, expect, it } from 'vitest'
import { sessionNeedsRefresh } from './sessionExpiry'
import type { DropboxSession } from './types'

const session = (expiresAt: number, refreshToken?: string): DropboxSession => ({
  accessToken: 'fixture-access-token', expiresAt, refreshToken, accountName: 'Fixture',
})

describe('Dropbox session refresh threshold', () => {
  it('refreshes before expiry after a sleeping device resumes', () => {
    expect(sessionNeedsRefresh(session(59_000, 'fixture-refresh-token'), 0)).toBe(true)
    expect(sessionNeedsRefresh(session(-1, 'fixture-refresh-token'), 0)).toBe(true)
  })

  it('keeps a healthy token and a session without refresh access unchanged', () => {
    expect(sessionNeedsRefresh(session(60_000, 'fixture-refresh-token'), 0)).toBe(false)
    expect(sessionNeedsRefresh(session(1_000), 0)).toBe(false)
  })
})
