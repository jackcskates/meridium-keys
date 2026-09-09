import { access, readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const dist = resolve(root, 'dist')
const manifest = JSON.parse(await readFile(resolve(dist, 'manifest.webmanifest'), 'utf8'))
const html = await readFile(resolve(dist, 'index.html'), 'utf8')

const assert = (condition, message) => {
  if (!condition) throw new Error(`PWA verification failed: ${message}`)
}

assert(manifest.name === 'Meridium Keys', 'manifest name is missing')
assert(manifest.id === '/' && manifest.scope === '/' && manifest.start_url === '/', 'app identity or scope is incorrect')
assert(manifest.display === 'standalone', 'standalone display is not configured')
assert(manifest.theme_color === '#0f0f0f' && manifest.background_color === '#0f0f0f', 'theme colors do not match Meridium')

for (const size of ['192x192', '512x512']) {
  assert(manifest.icons.some((icon) => icon.sizes === size && icon.purpose === 'any'), `${size} app icon is missing`)
  assert(manifest.icons.some((icon) => icon.sizes === size && icon.purpose === 'maskable'), `${size} maskable icon is missing`)
}

assert(html.includes('viewport-fit=cover'), 'safe-area viewport support is missing')
assert(html.includes('apple-mobile-web-app-capable'), 'iOS standalone metadata is missing')

await Promise.all([
  access(resolve(dist, 'sw.js')),
  access(resolve(dist, 'apple-touch-icon.png')),
  access(resolve(dist, 'icon-192x192.png')),
  access(resolve(dist, 'icon-512x512.png')),
])

const renderedIconSizes = await Promise.all([
  stat(resolve(dist, 'apple-touch-icon.png')),
  stat(resolve(dist, 'icon-192x192.png')),
  stat(resolve(dist, 'icon-512x512.png')),
  stat(resolve(dist, 'icon-192x192-maskable.png')),
  stat(resolve(dist, 'icon-512x512-maskable.png')),
])
assert(renderedIconSizes.every((icon) => icon.size > 3_000), 'an app icon appears to be blank or incomplete')

console.log('PWA verification passed: manifest, service worker, iOS metadata, and install icons are present.')
