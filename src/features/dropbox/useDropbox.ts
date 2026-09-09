import { useCallback, useEffect, useRef, useState } from 'react'
import { downloadDropboxVault, listDropboxVaults, loadDropboxAccount, uploadNewDropboxVault } from './client'
import { beginDropboxAuthorization, completeDropboxAuthorization, DropboxAuthError } from './oauth'
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
      const [accountName, remoteVaults] = await Promise.all([
        loadDropboxAccount(activeSession),
        listDropboxVaults(activeSession),
      ])
      setSession({ ...activeSession, accountName })
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
      .then((connectedSession) => {
        if (connectedSession) void loadLibrary(connectedSession)
      })
      .catch((authError) => {
        setError(authError instanceof DropboxAuthError ? authError.message : 'Dropbox could not connect securely.')
        setStatus('error')
      })
  }, [loadLibrary])

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
    const vault = await uploadNewDropboxVault(session, file)
    await loadLibrary(session)
    return vault
  }

  function disconnect() {
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
    refresh,
  }
}
