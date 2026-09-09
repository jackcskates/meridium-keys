import { useMemo, useState } from 'react'
import type { VaultEntrySummary, VaultSnapshot } from './types'

type VaultBrowserProps = {
  vault: VaultSnapshot
  onLock: () => void
}

function entrySubtitle(entry: VaultEntrySummary) {
  return entry.username || entry.url || 'No username or URL'
}

export function VaultBrowser({ vault, onLock }: VaultBrowserProps) {
  const [selectedGroupId, setSelectedGroupId] = useState('all')
  const visibleEntries = useMemo(
    () => selectedGroupId === 'all'
      ? vault.entries
      : vault.entries.filter((entry) => entry.groupId === selectedGroupId),
    [selectedGroupId, vault.entries],
  )
  const [selectedEntryId, setSelectedEntryId] = useState(vault.entries[0]?.id ?? '')
  const selectedEntry = visibleEntries.find((entry) => entry.id === selectedEntryId) ?? visibleEntries[0]

  function selectGroup(groupId: string) {
    setSelectedGroupId(groupId)
    const firstEntry = groupId === 'all'
      ? vault.entries[0]
      : vault.entries.find((entry) => entry.groupId === groupId)
    setSelectedEntryId(firstEntry?.id ?? '')
  }

  return (
    <div className="vault-browser">
      <header className="vault-browser-header">
        <div>
          <p className="eyebrow">Read-only KDBX {vault.version}</p>
          <h1>{vault.databaseName}</h1>
          <p>{vault.entries.length} {vault.entries.length === 1 ? 'entry' : 'entries'} · decrypted in memory</p>
        </div>
        <button className="button button-secondary" onClick={onLock} type="button">Lock vault</button>
      </header>

      <div className="vault-browser-grid">
        <aside className="group-list" aria-label="Vault groups">
          <h2>Groups</h2>
          <button className={selectedGroupId === 'all' ? 'is-selected' : ''} onClick={() => selectGroup('all')} type="button">
            <span>All entries</span><small>{vault.entries.length}</small>
          </button>
          {vault.groups.map((group) => (
            <button
              className={selectedGroupId === group.id ? 'is-selected' : ''}
              key={group.id}
              onClick={() => selectGroup(group.id)}
              style={{ paddingInlineStart: `${12 + group.depth * 12}px` }}
              title={group.path}
              type="button"
            >
              <span>{group.name}</span><small>{group.entryCount}</small>
            </button>
          ))}
        </aside>

        <section className="entry-list" aria-label="Vault entries">
          <h2>Entries</h2>
          {visibleEntries.length ? visibleEntries.map((entry) => (
            <button
              className={selectedEntryId === entry.id ? 'is-selected' : ''}
              key={entry.id}
              onClick={() => setSelectedEntryId(entry.id)}
              type="button"
            >
              <span className="entry-glyph">{entry.title.slice(0, 1).toUpperCase()}</span>
              <span><strong>{entry.title}</strong><small>{entrySubtitle(entry)}</small></span>
            </button>
          )) : <p className="vault-empty-state">No entries in this group.</p>}
        </section>

        <section className="entry-detail" aria-label="Selected entry">
          {selectedEntry ? (
            <>
              <div className="entry-detail-heading">
                <span className="entry-glyph entry-glyph-large">{selectedEntry.title.slice(0, 1).toUpperCase()}</span>
                <div><p className="eyebrow">Entry</p><h2>{selectedEntry.title}</h2></div>
              </div>
              <dl>
                <div><dt>Username</dt><dd>{selectedEntry.username || '—'}</dd></div>
                <div><dt>Website</dt><dd>{selectedEntry.url || '—'}</dd></div>
                <div><dt>Password</dt><dd className="masked-secret">{selectedEntry.hasPassword ? '••••••••••••' : '—'}</dd></div>
              </dl>
              <p className="read-only-note">Secrets remain protected. Reveal, copy, edit, and save are intentionally disabled in this read-only compatibility function.</p>
            </>
          ) : <p className="vault-empty-state">Choose an entry to inspect it.</p>}
        </section>
      </div>
    </div>
  )
}
