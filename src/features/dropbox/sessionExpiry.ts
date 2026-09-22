import type { DropboxSession } from './types'

export function sessionNeedsRefresh(session: DropboxSession, now = Date.now()): session is DropboxSession & { refreshToken: string } {
  return Boolean(session.refreshToken) && session.expiresAt - now < 60_000
}
