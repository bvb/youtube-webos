#!/bin/sh
# Presses one remote key, then prints the newest toasts and the subtitle state.
# Usage: ./press.sh <key>

if [ -z "$1" ]; then
  echo 'Usage: ./press.sh <key>' >&2
  exit 2
fi

dir=$(dirname "$0")
node "$dir/keys.mjs" "$1" >/dev/null || exit
sleep 0.8
exec node "$dir/eval.mjs" "$dir/snippets/status.js"
