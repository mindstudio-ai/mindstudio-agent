#!/bin/bash
set -euo pipefail

BASE_URL="https://f.mscdn.ai/agent"
BINARY_NAME="mindstudio"
INSTALL_DIR="/usr/local/bin"

C='\033[36m'     # cyan
B='\033[96;1m'   # bright cyan bold
R='\033[0m'      # reset
GREEN='\033[32m'
RED='\033[1;31m'
GRAY='\033[90m'
BOLD='\033[1m'

logo() {
  echo ""
  echo -e "  ${C}       .${B}=${C}+${C}-.     :${B}+${C}+${C}.${R}"
  echo -e "  ${C}      ${B}*@@@@@${C}+  ${C}:${B}%@@@@%${C}:${R}"
  echo -e "  ${C}    .${B}%@@@@@@#${C}..${B}@@@@@@@${C}=${R}"
  echo -e "  ${C}  .${B}*@@@@@@@${C}--${B}@@@@@@@#${C}.${B}**${C}.${R}"
  echo -e "  ${C}  ${B}*@@@@@@@${C}.${B}-@@@@@@@@${C}.${B}#@@*${R}"
  echo -e "  ${C}.${B}#@@@@@@@${C}-.${B}@@@@@@@*${C} ${B}#@@@@%${C}.${R}"
  echo -e "  ${C}=${B}@@@@@@@${C}-.${B}@@@@@@@#${C}.${C}-${B}@@@@@@${C}+${R}"
  echo -e "  ${C}:${B}@@@@@@${C}:  ${C}+${B}@@@@@#${C}. ${C}.${B}@@@@@@${C}:${R}"
  echo -e "  ${C}  .${C}+${C}+${C}:     .${C}-${B}*${C}-.     .${C}+${C}+${C}:${R}"
  echo ""
  echo -e "  ${B}MindStudio CLI${R}"
  echo ""
}

step() {
  echo -e "  ${C}>${R} $1"
}

success() {
  echo -e "  ${GREEN}✓${R} $1"
}

fail() {
  echo -e "  ${RED}✗${R} $1"
  exit 1
}

logo

# Check for npm global install and remove it
if npm ls -g @mindstudio-ai/agent --depth=0 >/dev/null 2>&1; then
  step "Removing existing npm global install..."
  npm uninstall -g @mindstudio-ai/agent >/dev/null 2>&1 || true
  success "Removed npm global install"
fi

# Detect OS
OS="$(uname -s)"
case "$OS" in
  Darwin) os="darwin" ;;
  Linux)  os="linux" ;;
  *)
    fail "Unsupported operating system: $OS"
    ;;
esac

# Detect architecture
ARCH="$(uname -m)"
case "$ARCH" in
  arm64|aarch64) arch="arm64" ;;
  x86_64)        arch="x64" ;;
  *)
    fail "Unsupported architecture: $ARCH"
    ;;
esac

# Linux arm64 not supported yet
if [ "$os" = "linux" ] && [ "$arch" = "arm64" ]; then
  fail "Linux arm64 binaries are not available yet.\n  Install via npm instead: npm install -g @mindstudio-ai/agent"
fi

ARTIFACT="${BINARY_NAME}-${os}-${arch}"
DOWNLOAD_URL="${BASE_URL}/latest/${ARTIFACT}"

step "Detected ${BOLD}${os}/${arch}${R}"
step "Downloading binary..."

TMPFILE=$(mktemp)
if ! curl -fsSL "$DOWNLOAD_URL" -o "$TMPFILE" 2>/dev/null; then
  fail "Download failed. Check your internet connection and try again."
fi

chmod +x "$TMPFILE"

# Install to INSTALL_DIR, using sudo if needed
if [ -w "$INSTALL_DIR" ]; then
  mv "$TMPFILE" "${INSTALL_DIR}/${BINARY_NAME}"
else
  step "Installing to ${INSTALL_DIR} ${GRAY}(requires sudo)${R}"
  sudo mv "$TMPFILE" "${INSTALL_DIR}/${BINARY_NAME}"
fi

success "Installed to ${BOLD}${INSTALL_DIR}/${BINARY_NAME}${R}"
echo ""
echo -e "  Run ${B}${BINARY_NAME} login${R} to get started."
echo ""
