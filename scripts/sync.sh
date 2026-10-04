#!/bin/sh
# copy the art the client uses from ../assets into public/. `-n` shows the changes only.
cd "$(dirname "$0")/.." || exit 1
a=../assets
opt="-a --itemize-changes $1"

mkdir -p public/art public/models/painted/stations

rsync $opt --include='*.glb' --exclude='*' $a/exports/painted/stations/ public/models/painted/stations/
rsync $opt --include='*.webp' --exclude='*' $a/planets/ public/art/planets/
rsync $opt --include='*.webp' --exclude='*' $a/suns/ public/art/suns/
