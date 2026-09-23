import type { VaultEntryType, VaultSnapshot } from './types'

export type RecentTarget = { kind: 'entry' | 'folder'; id: string }
export type RecentHistory = { entries: string[]; folders: string[] }
export type RecentShortcut = { target: RecentTarget; title: string; subtitle: string; type?: VaultEntryType }

const maxRecentPerKind = 4

export function rememberRecentAccess(history: RecentHistory | undefined, target: RecentTarget): RecentHistory {
  const current = history ?? { entries: [], folders: [] }
  const field = target.kind === 'entry' ? 'entries' : 'folders'
  return { ...current, [field]: [target.id, ...current[field].filter((id) => id !== target.id)].slice(0, maxRecentPerKind) }
}

export function resolveRecentAccess(vault: VaultSnapshot, history: RecentHistory | undefined): { entries: RecentShortcut[]; folders: RecentShortcut[] } {
  if (!history) return { entries: [], folders: [] }
  const entries = history.entries.flatMap((id): RecentShortcut[] => {
    const entry = vault.entries.find((candidate) => candidate.id === id && !candidate.isDeleted)
    if (!entry) return []
    const folder = vault.groups.find((group) => group.id === entry.groupId)
    return [{ target: { kind: 'entry', id }, title: entry.title, subtitle: folder?.path || 'No folder', type: entry.type }]
  })
  const folders = history.folders.flatMap((id): RecentShortcut[] => {
    const folder = vault.groups.find((candidate) => candidate.id === id && !candidate.isRecycleBin)
    return folder ? [{ target: { kind: 'folder', id }, title: folder.name, subtitle: `${folder.entryCount} ${folder.entryCount === 1 ? 'key' : 'keys'}` }] : []
  })
  return { entries, folders }
}
