import { dropboxAppKey, getDropboxRedirectUri } from './config'
import type { DropboxSession } from './types'

const authorizationEndpoint = 'https://www.dropbox.com/oauth2/authorize'
const tokenEndpoint = 'https://api.dropboxapi.com/oauth2/token'
const transactionKey = 'meridium.keys.dropbox.oauth'
const transactionLifetime = 10 * 60 * 1000

type OAuthTransaction = {
  state: string
  verifier: string
  redirectUri: string
  createdAt: number
}

type TokenResponse = {
  access_token?: string
  expires_in?: number
  refresh_token?: string
}

let callbackPromise: Promise<DropboxSession | null> | null = null

export class DropboxAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DropboxAuthError'
  }
}

function randomUrlSafe(length: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return base64Url(bytes.buffer)
}

function base64Url(data: ArrayBuffer) {
  const bytes = new Uint8Array(data)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

async function createChallenge(verifier: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64Url(digest)
}

function clearCallbackQuery() {
  history.replaceState({}, document.title, `${window.location.pathname}${window.location.hash}`)
}

export async function beginDropboxAuthorization() {
  const verifier = randomUrlSafe(96)
  const state = randomUrlSafe(48)
  const redirectUri = getDropboxRedirectUri()
  const challenge = await createChallenge(verifier)
  const transaction: OAuthTransaction = { state, verifier, redirectUri, createdAt: Date.now() }
  sessionStorage.setItem(transactionKey, JSON.stringify(transaction))

  const query = new URLSearchParams({
    client_id: dropboxAppKey,
    redirect_uri: redirectUri,
    response_type: 'code',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    token_access_type: 'offline',
    state,
  })

  window.location.assign(`${authorizationEndpoint}?${query}`)
}

async function exchangeCallback(): Promise<DropboxSession | null> {
  const query = new URLSearchParams(window.location.search)
  const code = query.get('code')
  const returnedState = query.get('state')
  const oauthError = query.get('error_description') || query.get('error')
  if (!code && !oauthError) return null

  clearCallbackQuery()
  const stored = sessionStorage.getItem(transactionKey)
  sessionStorage.removeItem(transactionKey)

  if (oauthError) throw new DropboxAuthError('Dropbox authorization was cancelled or denied.')
  if (!stored || !code || !returnedState) {
    throw new DropboxAuthError('The Dropbox authorization session expired. Connect again.')
  }

  let transaction: OAuthTransaction
  try {
    transaction = JSON.parse(stored) as OAuthTransaction
  } catch {
    throw new DropboxAuthError('The Dropbox authorization session was invalid. Connect again.')
  }

  if (
    transaction.state !== returnedState
    || Date.now() - transaction.createdAt > transactionLifetime
    || transaction.redirectUri !== getDropboxRedirectUri()
  ) {
    throw new DropboxAuthError('The Dropbox authorization response could not be verified. Connect again.')
  }

  const body = new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    client_id: dropboxAppKey,
    code_verifier: transaction.verifier,
    redirect_uri: transaction.redirectUri,
  })
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const payload = await response.json() as TokenResponse
  if (!response.ok || !payload.access_token || !payload.expires_in) {
    throw new DropboxAuthError('Dropbox could not finish the secure connection. Connect again.')
  }

  return {
    accessToken: payload.access_token,
    expiresAt: Date.now() + payload.expires_in * 1000,
    refreshToken: payload.refresh_token,
    accountName: '',
  }
}

export async function refreshDropboxAuthorization(refreshToken: string): Promise<DropboxSession> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    client_id: dropboxAppKey,
  })
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const payload = await response.json() as TokenResponse
  if (!response.ok || !payload.access_token || !payload.expires_in) {
    throw new DropboxAuthError('Dropbox could not restore the saved connection. Connect again.')
  }
  return {
    accessToken: payload.access_token,
    expiresAt: Date.now() + payload.expires_in * 1000,
    refreshToken: payload.refresh_token || refreshToken,
    accountName: '',
  }
}

export function completeDropboxAuthorization() {
  callbackPromise ??= exchangeCallback()
  return callbackPromise
}
