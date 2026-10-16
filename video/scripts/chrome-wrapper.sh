#!/bin/sh
# Optional: wraps Remotion's headless shell with flags that avoid helper-process
# crashes in restricted (sandboxed) environments. Use via:
#   npx remotion render ... --browser-executable scripts/chrome-wrapper.sh
DIR="$(cd "$(dirname "$0")/.." && pwd)"
exec "$DIR/node_modules/.remotion/chrome-headless-shell/mac-arm64/chrome-headless-shell-mac-arm64/chrome-headless-shell" --single-process --in-process-gpu "$@"
