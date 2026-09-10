import { afterEach, describe, expect, it, vi } from 'vitest'
import { dropboxAppKey } from './config'
import { beginDropboxAuthorization, completeDropboxAuthorization, refreshDropboxAuthorization } from './oauth'

function createSessionStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size },
  } satisfies Storage
}

afterEach(() => vi.unstubAllGlobals())

describe('Dropbox PKCE authorization', () => {
  it('creates and completes a verified client-only authorization transaction', async () => {
    const assign = vi.fn()
    const replaceState = vi.fn()
    const storage = createSessionStorage()
    const location = {
      origin: 'https://keys.meridium.app',
      pathname: '/',
      hash: '',
      search: '',
      assign,
    }
    vi.stubGlobal('window', { location })
    vi.stubGlobal('history', { replaceState })
    vi.stubGlobal('document', { title: 'Meridium Keys' })
    vi.stubGlobal('sessionStorage', storage)

    await beginDropboxAuthorization()

    const authorizationUrl = new URL(String(assign.mock.calls[0][0]))
    expect(authorizationUrl.origin).toBe('https://www.dropbox.com')
    expect(authorizationUrl.searchParams.get('client_id')).toBe(dropboxAppKey)
    expect(authorizationUrl.searchParams.get('redirect_uri')).toBe('https://keys.meridium.app/')
    expect(authorizationUrl.searchParams.get('response_type')).toBe('code')
    expect(authorizationUrl.searchParams.get('code_challenge_method')).toBe('S256')
    expect(authorizationUrl.searchParams.get('token_access_type')).toBe('offline')
    expect(authorizationUrl.searchParams.has('client_secret')).toBe(false)

    const state = authorizationUrl.searchParams.get('state')
    expect(state).toBeTruthy()
    location.search = `?code=single-use-code&state=${encodeURIComponent(String(state))}`
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'short-lived-token',
        expires_in: 14_400,
        refresh_token: 'persistent-refresh-token',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'restored-short-lived-token',
        expires_in: 14_400,
      }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const session = await completeDropboxAuthorization()

    expect(session?.accessToken).toBe('short-lived-token')
    expect(session?.refreshToken).toBe('persistent-refresh-token')
    expect(storage.length).toBe(0)
    expect(replaceState).toHaveBeenCalledWith({}, 'Meridium Keys', '/')
    const tokenBody = fetchMock.mock.calls[0][1]?.body as URLSearchParams
    expect(tokenBody.get('grant_type')).toBe('authorization_code')
    expect(tokenBody.get('code_verifier')?.length).toBeGreaterThanOrEqual(43)
    expect(tokenBody.has('client_secret')).toBe(false)

    const restored = await refreshDropboxAuthorization('persistent-refresh-token')
    expect(restored).toMatchObject({ accessToken: 'restored-short-lived-token', refreshToken: 'persistent-refresh-token' })
    const refreshBody = fetchMock.mock.calls[1][1]?.body as URLSearchParams
    expect(refreshBody.get('grant_type')).toBe('refresh_token')
    expect(refreshBody.get('client_id')).toBe(dropboxAppKey)
    expect(refreshBody.has('client_secret')).toBe(false)
  })
})
