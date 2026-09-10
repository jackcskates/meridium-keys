import {
  BadgeCheck,
  Barcode,
  Braces,
  CircleUserRound,
  Contact,
  Database,
  FileText,
  KeyRound,
  LogIn,
  WalletCards,
  type LucideIcon,
} from 'lucide-react'
import type { VaultEntryType } from './types'

const iconsByType: Record<VaultEntryType, LucideIcon> = {
  note: FileText,
  login: LogIn,
  account: CircleUserRound,
  database: Database,
  password: KeyRound,
  'api-key': Braces,
  identity: Contact,
  membership: BadgeCheck,
  'crypto-wallet': WalletCards,
  'serial-number': Barcode,
}

export function EntryTypeIcon({ type, size = 18 }: { type: VaultEntryType; size?: number }) {
  const TypeIcon = iconsByType[type]
  return <TypeIcon aria-hidden="true" size={size} strokeWidth={1.8} />
}
