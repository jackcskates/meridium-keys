# PWA Installation and Device Behavior

Status: application shell implemented; vault offline storage remains planned.

## What is installed

Meridium Keys is a standard progressive web app. Installation adds the web
client, Meridium icons, theme metadata, and a generated service worker to the
device. It does not install an OpenAI runtime and it does not move vault
decryption to Vercel or another server.

The same HTTPS application at `https://keys.meridium.app/` can run in a browser
or in a standalone app window. The manifest identity, start URL, and scope are
all rooted at `/` so the Dropbox OAuth callback returns to the installed app's
own origin.

## Current installation paths

- Chromium-based browsers can show the native install prompt from the in-app
  Meridium install notice.
- On iPhone and iPad, the notice explains the Share > Add to Home Screen flow.
- Once installed, the notice is hidden and the app uses standalone display.
- A Meridium Apple touch icon and both regular and maskable 192 px and 512 px
  icons are included. Phone and desktop assets use the same optical mark scale;
  the mark remains inside the Android maskable safe area.
- Icon URLs carry an artwork version so a new installation does not reuse the
  earlier undersized phone icon from browser cache.

An icon already installed on an iPhone is controlled by iOS and is not reliably
replaced by a service-worker update. After this icon change, remove the existing
Home Screen app once and add `keys.meridium.app` to the Home Screen again.

## Offline boundary

The service worker precaches only the versioned application shell: HTML,
JavaScript, CSS, fonts, and public app icons. It has no Dropbox API runtime-cache
rule. Dropbox responses, bearer tokens, downloaded KDBX files, and decrypted
vault data are not placed in Cache Storage.

Today, an installed app can load its interface without a network connection and
can still open a KDBX file explicitly selected from the device. Dropbox listing
and download require connectivity. Encrypted offline Dropbox vault storage will
be added only after the per-device App Lock envelope is implemented.

## Lifecycle behavior

- Online and offline changes update the Dropbox status immediately.
- After one device authorization, launch and reload automatically restore the
  Dropbox library from the encrypted refresh credential. Sign out removes it.
- Service-worker updates wait for user approval; the interface asks the user to
  lock open vaults before applying an update. The app checks at launch, when it
  regains focus, when a page is restored or connectivity returns, and every 60
  seconds while it remains open. An already-waiting worker also surfaces the
  prompt even if its original update callback was missed.
- Phone layouts respect display cutouts and home-indicator safe areas.

## Verification

After a production build, run `npm run verify:pwa`. It checks the built
manifest identity and standalone mode, Meridium colors, iOS metadata, service
worker, Apple touch icon, and regular and maskable install icons.
