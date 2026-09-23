export function unlockInputWarning(password: string): string | null {
  if (/[\u200B-\u200D\u2060\uFEFF]/u.test(password)) {
    return 'The entered password contains an invisible character. Check what was pasted or typed on this device.'
  }
  if (/^\s|\s$/u.test(password)) {
    return 'The entered password begins or ends with whitespace. KeePass treats that as part of the password; check whether it was intentional.'
  }
  if (password.normalize('NFC') !== password) {
    return 'Some characters in this password can look identical across devices while using different Unicode bytes. Compare the revealed text carefully.'
  }
  return null
}
