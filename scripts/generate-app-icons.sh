#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
renderer=${RSVG_CONVERT:-rsvg-convert}

for size in 192 512 1024; do
  "$renderer" --width "$size" --height "$size" --output "$repo_root/public/icon-${size}x${size}-v3.png" "$repo_root/assets/branding/app-icon.svg"
  "$renderer" --width "$size" --height "$size" --output "$repo_root/public/icon-${size}x${size}-maskable-v3.png" "$repo_root/assets/branding/app-icon-maskable.svg"
done
"$renderer" --width 180 --height 180 --output "$repo_root/public/apple-touch-icon-v3.png" "$repo_root/assets/branding/apple-touch-icon.svg"
cp "$repo_root/assets/branding/app-icon.svg" "$repo_root/public/favicon-v3.svg"
