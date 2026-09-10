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

assert(manifest.icons.every((icon) => icon.src.includes('-v2.png')), 'manifest icons are not cache-busted for the enlarged artwork')

assert(html.includes('viewport-fit=cover'), 'safe-area viewport support is missing')
assert(html.includes('apple-mobile-web-app-capable'), 'iOS standalone metadata is missing')
assert(html.includes('apple-touch-icon-v2.png'), 'Apple touch icon is not cache-busted')

await Promise.all([
  access(resolve(dist, 'sw.js')),
  access(resolve(dist, 'apple-touch-icon-v2.png')),
  access(resolve(dist, 'icon-192x192-v2.png')),
  access(resolve(dist, 'icon-512x512-v2.png')),
])

const renderedIconSizes = await Promise.all([
  stat(resolve(dist, 'apple-touch-icon-v2.png')),
  stat(resolve(dist, 'icon-192x192-v2.png')),
  stat(resolve(dist, 'icon-512x512-v2.png')),
  stat(resolve(dist, 'icon-192x192-maskable-v2.png')),
  stat(resolve(dist, 'icon-512x512-maskable-v2.png')),
])
assert(renderedIconSizes.every((icon) => icon.size > 3_000), 'an app icon appears to be blank or incomplete')

const [regular192, maskable192, regular512, maskable512, maskableSource, appleSource] = await Promise.all([
  readFile(resolve(dist, 'icon-192x192-v2.png')),
  readFile(resolve(dist, 'icon-192x192-maskable-v2.png')),
  readFile(resolve(dist, 'icon-512x512-v2.png')),
  readFile(resolve(dist, 'icon-512x512-maskable-v2.png')),
  readFile(resolve(root, 'assets/branding/app-icon-maskable.svg'), 'utf8'),
  readFile(resolve(root, 'assets/branding/apple-touch-icon.svg'), 'utf8'),
])
assert(regular192.equals(maskable192) && regular512.equals(maskable512), 'phone and desktop icon artwork scales do not match')
assert(maskableSource.includes('viewBox="-89 -89 600 600"') && appleSource.includes('viewBox="-89 -89 600 600"'), 'phone icon source scale regressed')

console.log('PWA verification passed: manifest, service worker, iOS metadata, and install icons are present.')
