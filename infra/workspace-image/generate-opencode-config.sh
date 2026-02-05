#!/bin/sh
set -e

WORKSPACE_DIR="${WORKSPACE_DIR:-/workspace}"
KB_CONFIG_DIR="${KB_CONFIG_DIR:-/kb-config}"
CONFIG_FILE_NAME="${CONFIG_FILE_NAME:-CommonWorkspaceConfig.json}"
AGENTS_FILE_NAME="${AGENTS_FILE_NAME:-AGENTS.md}"
OPENCODE_CONFIG_PATH="${OPENCODE_CONFIG_PATH:-$WORKSPACE_DIR/opencode.json}"
WORKSPACE_AGENTS_PATH="${WORKSPACE_AGENTS_PATH:-$WORKSPACE_DIR/AGENTS.md}"

log() {
  echo "[init-workspace] $1"
}

if [ ! -d "$KB_CONFIG_DIR" ]; then
  log "Config repository not mounted at $KB_CONFIG_DIR, skipping OpenCode config generation"
  exit 0
fi

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

git clone --quiet "$KB_CONFIG_DIR" "$TMP_DIR/repo" >/dev/null 2>&1 || {
  log "Failed to clone config repository from $KB_CONFIG_DIR"
  exit 0
}

CONFIG_PATH="$TMP_DIR/repo/$CONFIG_FILE_NAME"
if [ ! -f "$CONFIG_PATH" ]; then
  log "$CONFIG_FILE_NAME not found in config repository"
  exit 0
fi

cp "$CONFIG_PATH" "$OPENCODE_CONFIG_PATH"

AGENTS_PATH="$TMP_DIR/repo/$AGENTS_FILE_NAME"
if [ -f "$AGENTS_PATH" ]; then
  cp "$AGENTS_PATH" "$WORKSPACE_AGENTS_PATH"
fi

log "Generated runtime config files from config repository"
