type ClipboardPort = {
  write?: (items: ClipboardItem[]) => Promise<void>
  writeText?: (value: string) => Promise<void>
}

type ClipboardEnvironment = {
  clipboard: ClipboardPort | undefined
  createBlob: (value: string) => Blob
  createItem?: (blob: Promise<Blob>) => ClipboardItem
  preferPromiseItem: boolean
}

function browserClipboardEnvironment(): ClipboardEnvironment {
  const isAppleClipboard = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || navigator.vendor === 'Apple Computer, Inc.'
  return {
    clipboard: navigator.clipboard,
    createBlob: (value) => new Blob([value], { type: 'text/plain' }),
    createItem: typeof ClipboardItem === 'undefined' ? undefined : (blob) => new ClipboardItem({ 'text/plain': blob }),
    preferPromiseItem: isAppleClipboard,
  }
}

// Supplying the secret as a promise keeps Safari's clipboard permission tied to
// the original click while the worker decrypts only the requested field.
export async function copyProtectedText(readValue: () => Promise<string>, environment = browserClipboardEnvironment()) {
  const { clipboard } = environment
  if (!clipboard) throw new Error('Clipboard access is unavailable on this device.')
  const value = readValue()

  if (environment.preferPromiseItem && clipboard.write && environment.createItem) {
    try {
      const blob = value.then(environment.createBlob)
      await clipboard.write([environment.createItem(blob)])
      return
    } catch {
      // Some installed browsers expose ClipboardItem but reject promise-backed
      // data. Reuse the same one-field request with the simpler text API.
    }
  }

  if (!clipboard.writeText) throw new Error('Clipboard access is unavailable on this device.')
  await clipboard.writeText(await value)
}
