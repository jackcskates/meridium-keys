export type VaultPasswordRequirement = {
  id: 'length' | 'common' | 'vault-name' | 'confirmation'
  label: string
  met: boolean
}

const commonExamples = new Set([
  'password',
  'password123456789',
  '123456789012345',
  'qwertyuiopasdfgh',
  'letmeinletmeinletmein',
])

export function vaultPasswordRequirements(
  password: string,
  vaultName: string,
  confirmation: string,
): VaultPasswordRequirement[] {
  const characterCount = Array.from(password).length
  const normalizedPassword = password.toLocaleLowerCase()
  const normalizedVaultName = vaultName.trim().toLocaleLowerCase()

  return [
    {
      id: 'length',
      label: '15–128 characters',
      met: characterCount >= 15 && characterCount <= 128,
    },
    {
      id: 'common',
      label: 'Not a common or repeated password',
      met: Boolean(password.trim())
        && !commonExamples.has(normalizedPassword)
        && !/^(.)\1+$/u.test(password),
    },
    {
      id: 'vault-name',
      label: 'Different from the vault name',
      met: Boolean(password) && (!normalizedVaultName || normalizedPassword !== normalizedVaultName),
    },
    {
      id: 'confirmation',
      label: 'Both passwords match',
      met: Boolean(confirmation) && password === confirmation,
    },
  ]
}

export function vaultPasswordReady(password: string, vaultName: string, confirmation: string) {
  return vaultPasswordRequirements(password, vaultName, confirmation).every((requirement) => requirement.met)
}
