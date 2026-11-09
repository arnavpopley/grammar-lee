#!/usr/bin/env bash
# Installs a LanguageTool grammar server that runs only on this Mac (http://localhost:8081) and starts at login.
# grammar-lee detects it automatically and uses it as a second grammar engine.
#
#   ./setup-languagetool.sh              install (Homebrew) and start
#   ./setup-languagetool.sh --status     is it running?
#   ./setup-languagetool.sh --uninstall  stop and remove
#
# Uses Homebrew's languagetool formula, which brings its own Java. About 300 MB on disk, ~1 GB RAM while running.
set -euo pipefail

PORT=8081
say() { printf '\033[1;32m==>\033[0m %s\n' "$*"; }
die() { printf '\033[1;31mError:\033[0m %s\n' "$*" >&2; exit 1; }
running() { curl -fs --max-time 3 "http://localhost:$PORT/v2/languages" >/dev/null 2>&1; }

[[ "$(uname)" == "Darwin" ]] || die "This script is for macOS. On Linux: docker run -d -p 127.0.0.1:8081:8010 --restart unless-stopped erikvl87/languagetool"
command -v brew >/dev/null 2>&1 || die "Homebrew is needed: install it from https://brew.sh, then run this again."

case "${1:-}" in
  --status)
    if running; then say "LanguageTool is running on http://localhost:$PORT"; else say "LanguageTool is not running."; fi
    brew services list | grep -i languagetool || true
    exit 0
    ;;
  --uninstall)
    brew services stop languagetool 2>/dev/null || true
    brew uninstall languagetool 2>/dev/null || true
    say "LanguageTool removed."
    exit 0
    ;;
esac

# Earlier grammar-lee versions installed LanguageTool by hand; clean that up so two servers don't fight over the port.
OLD_PLIST="$HOME/Library/LaunchAgents/com.proofline.languagetool.plist"
if [[ -f "$OLD_PLIST" ]]; then
  launchctl bootout "gui/$(id -u)/com.proofline.languagetool" 2>/dev/null || true
  rm -f "$OLD_PLIST"
  rm -rf "$HOME/.proofline/languagetool"
  say "Removed the old hand-installed LanguageTool."
fi

if running; then
  say "LanguageTool is already running on http://localhost:$PORT. Nothing to do."
  exit 0
fi

if ! brew list languagetool >/dev/null 2>&1; then
  say "Installing LanguageTool with Homebrew (a few minutes the first time)…"
  brew install languagetool
fi
say "Starting LanguageTool as a login service…"
brew services restart languagetool >/dev/null

for _ in $(seq 1 90); do
  if running; then
    say "LanguageTool is running on http://localhost:$PORT and will start at login."
    say "grammar-lee switches it on by itself within a minute. Check: grammar-lee popup → LanguageTool → Connected."
    exit 0
  fi
  sleep 1
done
die "LanguageTool did not answer on port $PORT. Run: brew services list, and check $(brew --prefix)/var/log/languagetool* if it exists."
