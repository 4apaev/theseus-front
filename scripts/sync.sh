#!/bin/sh

# copy the art
# from ../assets
# into public/.
# `-n` shows the changes only.

cd "$(dirname "$0")/.." || exit 1
a=../assets
opt="-a --itemize-changes $1"

mkdir -p public/art public/models/painted/stations

# every painted model, the stations, the hulls and the modules. icarus waits: the client shows none yet
rsync $opt -m --exclude='icarus/' --include='*/' --include='*.glb' --exclude='*' $a/exports/painted/ public/models/painted/
rsync $opt --include='*.webp' --exclude='*' $a/planets/ public/art/planets/
rsync $opt --include='*.webp' --exclude='*' $a/suns/ public/art/suns/
# the places: the plate, the parts and the kit, no sources
rsync $opt -m --include='*/' --include='plate.webp' --include='parts/*.webp' --include='kit.json' --exclude='*' $a/places/ public/art/places/
# sam's toy models
rsync $opt -m --include='*/' --include='*.glb' --exclude='*' $a/exports/toy/ public/models/toy/
# the cc0 kits: kaykit, kenney, quaternius
rsync $opt -m --include='*/' --include='*.gltf' --include='*.glb' --include='*.bin' --include='*.png' --exclude='*' $a/kits/ public/models/kits/

[ "$1" = -n ] || python3 scripts/icons.py
