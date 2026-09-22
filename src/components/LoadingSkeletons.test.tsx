import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ConnectionSkeleton, EntryDetailSkeleton, VaultListSkeleton } from './LoadingSkeletons'

describe('loading skeletons', () => {
  it('holds the Dropbox vault-list geometry while records load', () => {
    const html = renderToStaticMarkup(<VaultListSkeleton />)
    expect(html).toContain('Loading Dropbox vaults')
    expect(html.match(/vault-skeleton-row/g)).toHaveLength(3)
    expect(html).not.toContain('aria-busy="false"')
  })

  it('keeps entry data out of placeholder markup', () => {
    const html = renderToStaticMarkup(<EntryDetailSkeleton />)
    expect(html).toContain('Loading entry fields')
    expect(html.match(/entry-detail-skeleton-field/g)).toHaveLength(4)
    expect(html).not.toContain('password')
  })

  it('labels initial connection restoration', () => {
    expect(renderToStaticMarkup(<ConnectionSkeleton />)).toContain('Checking Dropbox connection')
  })
})
