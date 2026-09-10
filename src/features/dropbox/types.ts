export type DropboxConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'loading'
  | 'connected'
  | 'error'

export type DropboxSession = {
  accessToken: string
  expiresAt: number
  refreshToken?: string
  accountName: string
}

export type DropboxVaultFile = {
  id: string
  name: string
  pathDisplay: string
  rev: string
  size: number
  serverModified: string
}
