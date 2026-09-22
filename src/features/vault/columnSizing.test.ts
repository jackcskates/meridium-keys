import { describe, expect, it } from 'vitest'
import {
  clampVaultColumnWidths,
  detailColumnMinWidth,
  entryColumnMinWidth,
  folderColumnMinWidth,
  columnResizeHandleWidth,
} from './columnSizing'

describe('vault column sizing', () => {
  it('keeps valid requested widths', () => {
    expect(clampVaultColumnWidths({ folders: 220, entries: 340 }, 1_100)).toEqual({ folders: 220, entries: 340 })
  })

  it('enforces minimum widths for folders and keys', () => {
    expect(clampVaultColumnWidths({ folders: 20, entries: 40 }, 1_100)).toEqual({
      folders: folderColumnMinWidth,
      entries: entryColumnMinWidth,
    })
  })

  it('preserves enough room for the detail pane and both dividers', () => {
    const gridWidth = 900
    const widths = clampVaultColumnWidths({ folders: 600, entries: 600 }, gridWidth)
    expect(widths.folders + widths.entries + detailColumnMinWidth + columnResizeHandleWidth * 2).toBe(gridWidth)
    expect(widths.entries).toBe(entryColumnMinWidth)
  })

  it('retains usable minimum panes in the narrowest desktop layout', () => {
    expect(clampVaultColumnWidths({ folders: 400, entries: 400 }, 590)).toEqual({
      folders: folderColumnMinWidth,
      entries: entryColumnMinWidth,
    })
  })
})
