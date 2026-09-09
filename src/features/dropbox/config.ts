// Dropbox OAuth client IDs are public identifiers. This is not an app secret.
export const dropboxAppKey = 'esf9ls0ti8nmlmv'

export function getDropboxRedirectUri() {
  return `${window.location.origin}/`
}
