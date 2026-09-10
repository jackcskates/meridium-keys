import { useCallback, useEffect, useRef, useState } from 'react'
import { deleteDropboxVault, downloadDropboxVault, listDropboxVaults, loadDropboxAccount, uploadDropboxVaultRevision, uploadNewDropboxVault } from './client'
import { forgetDropboxRefreshToken, loadDropboxRefreshToken, rememberDropboxRefreshToken } from './credentialStore'
import { beginDropboxAuthorization, completeDropboxAuthorization, DropboxAuthError, refreshDropboxAuthorization } from './oauth'
import type { DropboxConnectionStatus, DropboxSession, DropboxVaultFile } from './types'

export function useDropbox() {
  const [status, setStatus] = useState<DropboxConnectionStatus>(() => {
    const query = new URLSearchParams(window.location.search)
    return query.has('code') || query.has('error') ? 'connecting' : 'disconnected'
  })
  const [session, setSession] = useState<DropboxSession | null>(null)
  const [vaults, setVaults] = useState<DropboxVaultFile[]>([])
  const [error, setError] = useState('')
  const callbackStarted = useRef(false)

  const loadLibrary = useCallback(async (activeSession: DropboxSession) => {
    setStatus('loading')
    setError('')
    try {
      let usableSession = activeSession
      if (activeSession.refreshToken && activeSession.expiresAt - Date.now() < 60_000) {
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
      if (usableSession.refreshToken) void rememberDropboxRefreshToken(usableSession.refreshToken).catch(() => undefined)
      setSession({ ...usableSession, accountName })
      setVaults(remoteVaults)
      setStatus('connected')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Dropbox could not load the vault library.')
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    if (callbackStarted.current) return
    callbackStarted.current = true
    void completeDropboxAuthorization()
      .then(async (connectedSession) => {
        if (connectedSession) {
          if (connectedSession.refreshToken) void rememberDropboxRefreshToken(connectedSession.refreshToken).catch(() => undefined)
          await loadLibrary(connectedSession)
          return
        }
        const refreshToken = await loadDropboxRefreshToken().catch(() => null)
        if (!refreshToken) return
        setStatus('connecting')
        await loadLibrary(await refreshDropboxAuthorization(refreshToken))
      })
      .catch((authError) => {
        setError(authError instanceof DropboxAuthError ? authError.message : 'Dropbox could not connect securely.')
        setStatus('error')
      })
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

  async function download(vault: DropboxVaultFile) {
    if (!session) throw new Error('Connect Dropbox before opening this vault.')
    return downloadDropboxVault(session, vault)
  }

  async function upload(file: File) {
    if (!session) throw new Error('Connect Dropbox before creating a vault.')
    try {
      const vault = await uploadNewDropboxVault(session, file)
      await loadLibrary(session)
      return vault
    } catch (uploadError) {
      await loadLibrary(session)
      throw uploadError
    }
  }

  async function remove(vault: DropboxVaultFile) {
    if (!session) throw new Error('Connect Dropbox before deleting this vault.')
    try {
      await deleteDropboxVault(session, vault)
      await loadLibrary(session)
    } catch (deleteError) {
      await loadLibrary(session)
      throw deleteError
    }
  }

  async function save(vault: DropboxVaultFile, file: File) {
    if (!session) throw new Error('Connect Dropbox before saving this vault.')
    const updated = await uploadDropboxVaultRevision(session, vault, file)
    await loadLibrary(session)
    return updated
  }

  function disconnect() {
    void forgetDropboxRefreshToken().catch(() => undefined)
    setSession(null)
    setVaults([])
    setError('')
    setStatus('disconnected')
  }

  return {
    status,
    isConnected: status === 'connected' || status === 'loading',
    session,
    vaults,
    error,
    connect,
    disconnect,
    download,
    upload,
    remove,
    save,
    refresh,
  }
}
