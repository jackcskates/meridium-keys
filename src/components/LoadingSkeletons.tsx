export function VaultListSkeleton() {
  return <div aria-label="Loading Dropbox vaults" className="vault-list-skeleton" role="status">
    {[0, 1, 2].map((row) => <div className="vault-skeleton-row" key={row}>
      <span aria-hidden="true" className="skeleton-block vault-skeleton-icon" />
      <span aria-hidden="true" className="vault-skeleton-copy"><span className="skeleton-block skeleton-line" /><span className="skeleton-block skeleton-line is-short" /></span>
    </div>)}
  </div>
}

export function ConnectionSkeleton() {
  return <div aria-label="Restoring Dropbox connection" className="focus-card connect-card connection-skeleton" role="status"><span aria-hidden="true" className="skeleton-block connection-skeleton-icon" /><span aria-hidden="true" className="skeleton-block skeleton-line" /><span aria-hidden="true" className="skeleton-block skeleton-line is-short" /><p>Checking Dropbox connection…</p></div>
}

export function EntryDetailSkeleton() {
  return <div aria-label="Loading entry fields" className="entry-detail-skeleton" role="status">
    <div className="entry-detail-skeleton-heading"><span aria-hidden="true" className="skeleton-block entry-detail-skeleton-icon" /><span aria-hidden="true" className="skeleton-block skeleton-line" /></div>
    {[0, 1, 2, 3].map((row) => <div className="entry-detail-skeleton-field" key={row}><span aria-hidden="true" className="skeleton-block skeleton-line is-short" /><span aria-hidden="true" className="skeleton-block skeleton-line" /></div>)}
  </div>
}
