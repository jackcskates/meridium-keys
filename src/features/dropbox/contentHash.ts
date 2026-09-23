const blockSize = 4 * 1024 * 1024

function hex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function dropboxContentHash(file: Blob) {
  const blockHashes: Uint8Array[] = []
  for (let offset = 0; offset < file.size; offset += blockSize) {
    const block = await file.slice(offset, offset + blockSize).arrayBuffer()
    blockHashes.push(new Uint8Array(await crypto.subtle.digest('SHA-256', block)))
  }
  const combined = new Uint8Array(blockHashes.length * 32)
  blockHashes.forEach((hash, index) => combined.set(hash, index * 32))
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', combined)))
}
