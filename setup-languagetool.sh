#!/usr/bin/env bash
# Installs a LanguageTool server that runs only on this Mac (http://localhost:8081)
# and starts it automatically at login. grammar-lee uses it as a second grammar engine.
#
#   ./setup-languagetool.sh            install + start
#   ./setup-languagetool.sh --ngrams   also download English n-gram data (~8 GB, catches more
#                                      confused words like their/there, affect/effect)
#   ./setup-languagetool.sh --uninstall
set -euo pipefail

PORT=8081
HOME_DIR="$HOME/.grammar-lee"
LT_DIR="$HOME_DIR/languagetool"
NGRAM_DIR="$HOME_DIR/ngrams"
PLIST="$HOME/Library/LaunchAgents/com.grammar-lee.languagetool.plist"
LABEL="com.grammar-lee.languagetool"
LT_URL="https://languagetool.org/download/LanguageTool-stable.zip"
NGRAM_URL="https://languagetool.org/download/ngram-data/ngrams-en-20150817.zip"

say() { printf '\033[1;32m==>\033[0m %s\n' "$*"; }
die() { printf '\033[1;31mError:\033[0m %s\n' "$*" >&2; exit 1; }

if [[ "${1:-}" == "--uninstall" ]]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  rm -rf "$LT_DIR"
  say "Removed LanguageTool (n-gram data, if any, left in $NGRAM_DIR)."
  exit 0
fi

WANT_NGRAMS=0
[[ "${1:-}" == "--ngrams" ]] && WANT_NGRAMS=1

[[ "$(uname)" == "Darwin" ]] || die "This script is written for macOS. On Linux run: docker run -d -p 8081:8010 --restart unless-stopped erikvl87/languagetool"

# 1. Java 17+
java_ok() {
  command -v java >/dev/null 2>&1 || return 1
  local v
  v=$(java -version 2>&1 | awk -F'"' '/version/ {print $2}' | cut -d. -f1)
  [[ -n "$v" && "$v" -ge 17 ]]
}
if ! java_ok; then
  command -v brew >/dev/null 2>&1 || die "Java 17+ is needed. Install Homebrew (https://brew.sh) then re-run, or install a JDK yourself."
  say "Installing Java (Homebrew openjdk@21)…"
  brew install openjdk@21
  JDK_PREFIX="$(brew --prefix openjdk@21)"
  export PATH="$JDK_PREFIX/bin:$PATH"
  java_ok || die "Java install did not work. Try: brew reinstall openjdk@21"
fi
JAVA_BIN="$(command -v java)"
say "Using Java: $("$JAVA_BIN" -version 2>&1 | head -1)"

# 2. LanguageTool
mkdir -p "$HOME_DIR"
if [[ ! -f "$LT_DIR/languagetool-server.jar" ]]; then
  say "Downloading LanguageTool (~250 MB)…"
  tmp=$(mktemp -d)
  curl -fL --progress-bar "$LT_URL" -o "$tmp/lt.zip"
  unzip -q "$tmp/lt.zip" -d "$tmp"
  rm -rf "$LT_DIR"
  mv "$tmp"/LanguageTool-*/ "$LT_DIR"
  rm -rf "$tmp"
fi
[[ -f "$LT_DIR/languagetool-server.jar" ]] || die "languagetool-server.jar not found in $LT_DIR"

# 3. Optional n-grams
EXTRA_ARGS=()
if [[ $WANT_NGRAMS -eq 1 && ! -d "$NGRAM_DIR/en" ]]; then
  say "Downloading English n-grams (~8 GB, this takes a while)…"
  mkdir -p "$NGRAM_DIR"
  curl -fL --progress-bar "$NGRAM_URL" -o "$NGRAM_DIR/en.zip"
  unzip -q "$NGRAM_DIR/en.zip" -d "$NGRAM_DIR"
  rm -f "$NGRAM_DIR/en.zip"
fi
[[ -d "$NGRAM_DIR/en" ]] && EXTRA_ARGS+=("--languageModel" "$NGRAM_DIR")

# 4. Server config: local only, no public access
cat > "$LT_DIR/server.properties" <<EOF
cacheSize=1000
pipelineCaching=true
maxPipelinePoolSize=200
EOF

# 5. LaunchAgent so it starts at login and restarts if it crashes
mkdir -p "$(dirname "$PLIST")"
{
  cat <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array>
    <string>$JAVA_BIN</string><string>-Xmx1g</string>
    <string>-cp</string><string>$LT_DIR/languagetool-server.jar</string>
    <string>org.languagetool.server.HTTPServer</string>
    <string>--port</string><string>$PORT</string>
    <string>--config</string><string>$LT_DIR/server.properties</string>
EOF
  for a in "${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}"; do echo "    <string>$a</string>"; done
  cat <<EOF
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$HOME_DIR/languagetool.log</string>
  <key>StandardErrorPath</key><string>$HOME_DIR/languagetool.log</string>
</dict></plist>
EOF
} > "$PLIST"

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"

# 6. Wait until it answers
say "Starting LanguageTool on http://localhost:$PORT …"
for _ in $(seq 1 60); do
  if curl -fs "http://localhost:$PORT/v2/languages" >/dev/null 2>&1; then
    say "LanguageTool is running. In grammar-lee settings, switch on Use LanguageTool."
    exit 0
  fi
  sleep 1
done
die "LanguageTool did not start. Check $HOME_DIR/languagetool.log"
