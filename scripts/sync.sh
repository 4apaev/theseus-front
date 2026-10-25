#!/bin/sh

# copy the art
# from ../assets
# into public/.
# `-n` shows the changes only.

cd "$(dirname "$0")/.." || exit 1
a=../assets

# sam's toy models, meshopt compressed and quantized. a model is redone
# only when it is missing or older than its export. names, extras and
# materials stay: the client reads its berths, sockets and roles by them
find $a/exports/toy -name '*.glb' | while read -r src; do
    out=public/models/toy/${src#"$a/exports/toy/"}
    [ "$out" -nt "$src" ] && continue
    echo "model $out"
    [ "$1" = -n ] && continue
    mkdir -p "$(dirname "$out")"
    npx --no-install gltf-transform meshopt "$src" "$out" --level medium > /dev/null || exit 1
done

[ "$1" = -n ] || python3 scripts/icons.py
