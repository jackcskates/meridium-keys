import { useCallback, useEffect, useRef, useState } from 'react'
import { deleteDropboxVault, downloadDropboxVault, listDropboxVaults, loadDropboxAccount, renameDropboxVault, uploadDropboxVaultRevision, uploadNewDropboxVault } from './client'
import { forgetDropboxRefreshToken, loadDropboxRefreshToken, rememberDropboxRefreshToken } from './credentialStore'
import { beginDropboxAuthorization, completeDropboxAuthorization, DropboxAuthError, refreshDropboxAuthorization } from './oauth'
import type { DropboxConnectionStatus, DropboxSession, DropboxVaultFile } from './types'
import { removeVault, upsertVault } from './vaultLibrary'
import { sessionNeedsRefresh } from './sessionExpiry'

export function useDropbox() {
  const [status, setStatus] = useState<DropboxConnectionStatus>('connecting')
  const [session, setSession] = useState<DropboxSession | null>(null)
  const [vaults, setVaults] = useState<DropboxVaultFile[]>([])
  const [error, setError] = useState('')
  const libraryRequestRef = useRef(0)
  const connectionEpochRef = useRef(0)
  const refreshPromiseRef = useRef<Promise<DropboxSession> | null>(null)

  const loadLibrary = useCallback(async (activeSession: DropboxSession) => {
    const requestId = ++libraryRequestRef.current
    setStatus('loading')
    setError('')
    try {
      let usableSession = activeSession
      if (sessionNeedsRefresh(activeSession)) {
        usableSession = await refreshDropboxAuthorization(activeSession.refreshToken)
      }
      let accountName: string
      let remoteVaults: DropboxVaultFile[]
      try {
        [accountName, remoteVaults] = await Promise.all([
          loadDropboxAccount(usableSession),
          listDropboxVaults(usableSession),
        ])
      } catch (firstError) {
        if (!usableSession.refreshToken) throw firstError
        usableSession = await refreshDropboxAuthorization(usableSession.refreshToken)
        ;[accountName, remoteVaults] = await Promise.all([
          loadDropboxAccount(usableSession),
          listDropboxVaults(usableSession),
        ])
      }
      if (requestId !== libraryRequestRef.current) return
      if (usableSession.refreshToken) void rememberDropboxRefreshToken(usableSession.refreshToken).catch(() => undefined)
      setSession({ ...usableSession, accountName })
      setVaults(remoteVaults)
      setStatus('connected')
    } catch (loadError) {
      if (requestId !== libraryRequestRef.current) return
      setError(loadError instanceof Error ? loadError.message : 'Dropbox could not load the vault library.')
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    let active = true
    void completeDropboxAuthorization()
      .then(async (connectedSession) => {
        if (!active) return
        if (connectedSession) {
          await loadLibrary(connectedSession)
          return
        }
        const refreshToken = await loadDropboxRefreshToken().catch(() => null)
        if (!active) return
        if (!refreshToken) { setStatus('disconnected'); return }
        setStatus('connecting')
        await loadLibrary(await refreshDropboxAuthorization(refreshToken))
      })
      .catch((authError) => {
        if (!active) return
        setError(authError instanceof DropboxAuthError ? authError.message : 'Dropbox could not connect securely.')
        setStatus('error')
      })
    return () => { active = false; libraryRequestRef.current += 1; connectionEpochRef.current += 1 }
  }, [loadLibrary])

  useEffect(() => {
    if (!session?.refreshToken) return
    const delay = Math.max(5_000, session.expiresAt - Date.now() - 60_000)
    const timeout = window.setTimeout(() => { void loadLibrary(session) }, delay)
    return () => window.clearTimeout(timeout)
  }, [loadLibrary, session])

  useEffect(() => {
    const reconnect = () => {
      if (session) void loadLibrary(session)
    }
    window.addEventListener('online', reconnect)
    return () => window.removeEventListener('online', reconnect)
  }, [loadLibrary, session])

  async function connect() {
    setStatus('connecting')
    setError('')
    try {
      await beginDropboxAuthorization()
    } catch {
      setError('Dropbox authorization could not start on this device.')
      setStatus('error')
    }
  }

  async function refresh() {
    if (session) await loadLibrary(session)
  }

  async function sessionForRequest() {
    if (!session) throw new Error('Connect Dropbox before working with a vault.')
    if (!sessionNeedsRefresh(session)) return session
    const epoch = connectionEpochRef.current
    refreshPromiseRef.current ??= refreshDropboxAuthorization(session.refreshToken)
    try {
      const refreshed = await refreshPromiseRef.current
      if (epoch !== connectionEpochRef.current) throw new Error('The Dropbox connection changed. Reconnect before continuing.')
      const current = { ...refreshed, accountName: session.accountName }
      setSession(current)
      if (current.refreshToken) void rememberDropboxRefreshToken(current.refreshToken).catch(() => undefined)
      return current
    } finally {
      refreshPromiseRef.current = null
    }
  }

  async function download(vault: DropboxVaultFile) {
    return downloadDropboxVault(await sessionForRequest(), vault)
  }

  async function upload(file: File) {
    const vault = await uploadNewDropboxVault(await sessionForRequest(), file)
    libraryRequestRef.current += 1
    setVaults((current) => upsertVault(current, vault))
    setStatus('connected')
    setError('')
    return vault
  }

  async function remove(vault: DropboxVaultFile) {
    await deleteDropboxVault(await sessionForRequest(), vault)
    libraryRequestRef.current += 1
    setVaults((current) => removeVault(current, vault.id))
    setStatus('connected')
    setError('')
  }

  async function save(vault: DropboxVaultFile, file: File) {
    const updated = await uploadDropboxVaultRevision(await sessionForRequest(), vault, file)
    libraryRequestRef.current += 1
    setVaults((current) => upsertVault(current, updated))
    setStatus('connected')
    setError('')
    return updated
  }

  async function rename(vault: DropboxVaultFile, fileName: string) {
    const renamed = await renameDropboxVault(await sessionForRequest(), vault, fileName)
    libraryRequestRef.current += 1
    setVaults((current) => upsertVault(current, renamed))
    setStatus('connected')
    setError('')
    return renamed
  }

  function disconnect() {
    libraryRequestRef.current += 1
    connectionEpochRef.current += 1
    void forgetDropboxRefreshToken().catch(() => undefined)
    setSession(null)
    setVaults([])
    setError('')
    setStatus('disconnected')
  }

  return {
    status,
    isConnected: session !== null && (status === 'connected' || status === 'loading'),
    session,
    vaults,
    error,
    connect,
    disconnect,
    download,
    upload,
    remove,
    rename,
    save,
    refresh,
  }
}
