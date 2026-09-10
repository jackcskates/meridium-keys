#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
renderer=${RSVG_CONVERT:-rsvg-convert}

"$renderer" --width 192 --height 192 --output "$repo_root/public/icon-192x192-v2.png" "$repo_root/assets/branding/app-icon.svg"
"$renderer" --width 512 --height 512 --output "$repo_root/public/icon-512x512-v2.png" "$repo_root/assets/branding/app-icon.svg"
"$renderer" --width 192 --height 192 --output "$repo_root/public/icon-192x192-maskable-v2.png" "$repo_root/assets/branding/app-icon-maskable.svg"
"$renderer" --width 512 --height 512 --output "$repo_root/public/icon-512x512-maskable-v2.png" "$repo_root/assets/branding/app-icon-maskable.svg"
"$renderer" --width 180 --height 180 --output "$repo_root/public/apple-touch-icon-v2.png" "$repo_root/assets/branding/apple-touch-icon.svg"
