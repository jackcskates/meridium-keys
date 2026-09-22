export const folderColumnMinWidth = 145
export const entryColumnMinWidth = 205
export const detailColumnMinWidth = 240
export const columnResizeHandleWidth = 8

export type ColumnWidths = { folders: number; entries: number }

export function clampVaultColumnWidths(widths: ColumnWidths, gridWidth: number): ColumnWidths {
  if (!gridWidth) return widths
  const availableForFirstTwo = Math.max(
    folderColumnMinWidth + entryColumnMinWidth,
    gridWidth - detailColumnMinWidth - columnResizeHandleWidth * 2,
  )
  const folders = Math.min(Math.max(folderColumnMinWidth, widths.folders), availableForFirstTwo - entryColumnMinWidth)
  const entries = Math.min(Math.max(entryColumnMinWidth, widths.entries), availableForFirstTwo - folders)
  return { folders, entries }
}
