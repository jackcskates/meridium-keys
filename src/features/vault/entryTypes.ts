import type { VaultEntryDraft, VaultEntryType } from './types'

export type EntryFieldKind = 'text' | 'email' | 'url' | 'secret' | 'textarea' | 'secret-textarea' | 'date'

export type EntryFieldDefinition = {
  key: string
  label: string
  storageKey: string
  kind: EntryFieldKind
  required?: boolean
  placeholder?: string
}

export type EntryTypeDefinition = {
  id: VaultEntryType
  label: string
  description: string
  fields: EntryFieldDefinition[]
  summaryKeys: string[]
}

export const entryTypeDefinitions: EntryTypeDefinition[] = [
  {
    id: 'note', label: 'Note', description: 'Freeform information and reference notes.', summaryKeys: ['notes'],
    fields: [{ key: 'notes', label: 'Note', storageKey: 'Notes', kind: 'textarea', required: true }],
  },
  {
    id: 'login', label: 'Login', description: 'Website or application sign-in.', summaryKeys: ['username', 'url'],
    fields: [
      { key: 'username', label: 'Username or email', storageKey: 'UserName', kind: 'text' },
      { key: 'password', label: 'Password', storageKey: 'Password', kind: 'secret' },
      { key: 'url', label: 'Website', storageKey: 'URL', kind: 'url', placeholder: 'https://' },
      { key: 'notes', label: 'Notes', storageKey: 'Notes', kind: 'textarea' },
    ],
  },
  {
    id: 'account', label: 'Account', description: 'Social account with recovery information.', summaryKeys: ['username', 'url'],
    fields: [
      { key: 'username', label: 'Username or email', storageKey: 'UserName', kind: 'text' },
      { key: 'password', label: 'Password', storageKey: 'Password', kind: 'secret' },
      { key: 'url', label: 'Profile or service URL', storageKey: 'URL', kind: 'url', placeholder: 'https://' },
      { key: 'recoveryEmail', label: 'Recovery email', storageKey: 'Recovery Email', kind: 'email' },
      { key: 'recoveryPhone', label: 'Recovery phone', storageKey: 'Recovery Phone', kind: 'text' },
      { key: 'recoveryCodes', label: 'Recovery codes', storageKey: 'Recovery Codes', kind: 'secret-textarea' },
      { key: 'notes', label: 'Notes', storageKey: 'Notes', kind: 'textarea' },
    ],
  },
  {
    id: 'database', label: 'Database', description: 'Database host, credentials, and connection details.', summaryKeys: ['database', 'host', 'username'],
    fields: [
      { key: 'database', label: 'Database name', storageKey: 'Database', kind: 'text' },
      { key: 'host', label: 'Host', storageKey: 'Host', kind: 'text' },
      { key: 'port', label: 'Port', storageKey: 'Port', kind: 'text' },
      { key: 'username', label: 'Username', storageKey: 'UserName', kind: 'text' },
      { key: 'password', label: 'Password', storageKey: 'Password', kind: 'secret' },
      { key: 'connectionString', label: 'Connection string', storageKey: 'Connection String', kind: 'secret-textarea' },
      { key: 'notes', label: 'Notes', storageKey: 'Notes', kind: 'textarea' },
    ],
  },
  {
    id: 'password', label: 'Password', description: 'A standalone password or passphrase.', summaryKeys: ['url'],
    fields: [
      { key: 'password', label: 'Password', storageKey: 'Password', kind: 'secret', required: true },
      { key: 'url', label: 'Related website', storageKey: 'URL', kind: 'url', placeholder: 'https://' },
      { key: 'notes', label: 'Notes', storageKey: 'Notes', kind: 'textarea' },
    ],
  },
  {
    id: 'api-key', label: 'API Key', description: 'API credentials, secret, and endpoint.', summaryKeys: ['service', 'endpoint'],
    fields: [
      { key: 'service', label: 'Service', storageKey: 'Service', kind: 'text' },
      { key: 'apiKey', label: 'API key', storageKey: 'API Key', kind: 'secret', required: true },
      { key: 'apiSecret', label: 'API secret', storageKey: 'API Secret', kind: 'secret' },
      { key: 'endpoint', label: 'Endpoint', storageKey: 'Endpoint', kind: 'url', placeholder: 'https://' },
      { key: 'notes', label: 'Notes', storageKey: 'Notes', kind: 'textarea' },
    ],
  },
  {
    id: 'identity', label: 'Identity', description: 'Personal identity and document information.', summaryKeys: ['email', 'phone'],
    fields: [
      { key: 'fullName', label: 'Full name', storageKey: 'Full Name', kind: 'text' },
      { key: 'email', label: 'Email', storageKey: 'Email', kind: 'email' },
      { key: 'phone', label: 'Phone', storageKey: 'Phone', kind: 'text' },
      { key: 'address', label: 'Address', storageKey: 'Address', kind: 'textarea' },
      { key: 'birthDate', label: 'Date of birth', storageKey: 'Date of Birth', kind: 'date' },
      { key: 'idNumber', label: 'Identification number', storageKey: 'Identification Number', kind: 'secret' },
      { key: 'notes', label: 'Notes', storageKey: 'Notes', kind: 'textarea' },
    ],
  },
  {
    id: 'membership', label: 'Membership', description: 'Membership number, access, and renewal details.', summaryKeys: ['memberNumber', 'username'],
    fields: [
      { key: 'memberNumber', label: 'Member number', storageKey: 'Member Number', kind: 'text' },
      { key: 'username', label: 'Username or email', storageKey: 'UserName', kind: 'text' },
      { key: 'password', label: 'Password', storageKey: 'Password', kind: 'secret' },
      { key: 'url', label: 'Membership website', storageKey: 'URL', kind: 'url', placeholder: 'https://' },
      { key: 'expiration', label: 'Expiration or renewal date', storageKey: 'Expiration Date', kind: 'date' },
      { key: 'notes', label: 'Notes', storageKey: 'Notes', kind: 'textarea' },
    ],
  },
  {
    id: 'crypto-wallet', label: 'Crypto Wallet', description: 'Wallet address, recovery phrase, and private key.', summaryKeys: ['network', 'walletAddress'],
    fields: [
      { key: 'network', label: 'Network', storageKey: 'Network', kind: 'text' },
      { key: 'walletAddress', label: 'Wallet address', storageKey: 'Wallet Address', kind: 'text' },
      { key: 'seedPhrase', label: 'Recovery phrase', storageKey: 'Recovery Phrase', kind: 'secret-textarea' },
      { key: 'privateKey', label: 'Private key', storageKey: 'Private Key', kind: 'secret-textarea' },
      { key: 'pin', label: 'PIN', storageKey: 'PIN', kind: 'secret' },
      { key: 'notes', label: 'Notes', storageKey: 'Notes', kind: 'textarea' },
    ],
  },
  {
    id: 'serial-number', label: 'Serial Number', description: 'Product serial, purchase, and warranty details.', summaryKeys: ['manufacturer', 'model', 'serialNumber'],
    fields: [
      { key: 'manufacturer', label: 'Manufacturer', storageKey: 'Manufacturer', kind: 'text' },
      { key: 'model', label: 'Model', storageKey: 'Model', kind: 'text' },
      { key: 'serialNumber', label: 'Serial number', storageKey: 'Serial Number', kind: 'text', required: true },
      { key: 'purchaseDate', label: 'Purchase date', storageKey: 'Purchase Date', kind: 'date' },
      { key: 'warrantyExpiration', label: 'Warranty expiration', storageKey: 'Warranty Expiration', kind: 'date' },
      { key: 'notes', label: 'Notes', storageKey: 'Notes', kind: 'textarea' },
    ],
  },
]

export const entryTypeMetadataKey = 'Meridium Entry Type'

export function getEntryTypeDefinition(type: VaultEntryType) {
  return entryTypeDefinitions.find((definition) => definition.id === type) || entryTypeDefinitions[1]
}

export function isVaultEntryType(value: string): value is VaultEntryType {
  return entryTypeDefinitions.some((definition) => definition.id === value)
}

export function createEmptyEntryDraft(type: VaultEntryType, groupId: string): VaultEntryDraft {
  const definition = getEntryTypeDefinition(type)
  return {
    groupId,
    type,
    title: '',
    fields: Object.fromEntries(definition.fields.map((field) => [field.key, ''])),
  }
}

export function allTypedStorageKeys() {
  return new Set(entryTypeDefinitions.flatMap((definition) => definition.fields.map((field) => field.storageKey)))
}

export function entryTypeLabel(type: VaultEntryType) {
  return getEntryTypeDefinition(type).label
}
