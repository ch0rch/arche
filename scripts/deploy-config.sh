#!/bin/bash
# deploy-config.sh
# Despliega la configuración común al repo bare de configuración.
#
# Uso:
#   ./scripts/deploy-config.sh              # destino por defecto
#   ./scripts/deploy-config.sh /custom/path # destino custom

set -euo pipefail

CONFIG_SOURCE_DIR="${CONFIG_SOURCE_DIR:-$(dirname "$0")/../config}"
CONFIG_DEST="${1:-/opt/arche/kb-config}"
GIT_USER_NAME="${GIT_USER_NAME:-Arche Deploy}"
GIT_USER_EMAIL="${GIT_USER_EMAIL:-deploy@arche.local}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
  echo -e "${GREEN}[deploy-config]${NC} $1"
}

warn() {
  echo -e "${YELLOW}[deploy-config]${NC} $1"
}

error() {
  echo -e "${RED}[deploy-config]${NC} $1" >&2
  exit 1
}

if [ ! -d "$CONFIG_SOURCE_DIR" ]; then
  error "Config source directory not found: $CONFIG_SOURCE_DIR"
fi

if [ ! -f "$CONFIG_SOURCE_DIR/CommonWorkspaceConfig.json" ]; then
  error "Missing required file: $CONFIG_SOURCE_DIR/CommonWorkspaceConfig.json"
fi

is_bare_repo() {
  git --git-dir="$CONFIG_DEST" rev-parse --is-bare-repository >/dev/null 2>&1
}

is_non_bare_repo() {
  [ -d "$CONFIG_DEST/.git" ] && git -C "$CONFIG_DEST" rev-parse --is-inside-work-tree >/dev/null 2>&1
}

ensure_bare_repo() {
  if is_bare_repo; then
    return
  fi

  if is_non_bare_repo; then
    warn "Non-bare repo detected at $CONFIG_DEST. Migrating to bare repo..."
    local backup_dir
    local bare_tmp
    backup_dir="${CONFIG_DEST}.worktree.bak.$(date +%s)"
    bare_tmp="${CONFIG_DEST}.bare"

    git clone --bare "$CONFIG_DEST" "$bare_tmp"
    mv "$CONFIG_DEST" "$backup_dir"
    mv "$bare_tmp" "$CONFIG_DEST"
    log "Previous working tree moved to $backup_dir"
    return
  fi

  if [ -d "$CONFIG_DEST" ] && [ -n "$(ls -A "$CONFIG_DEST" 2>/dev/null)" ]; then
    warn "Directory $CONFIG_DEST is not empty and is not a git repo. Backing it up."
    local backup_dir
    backup_dir="${CONFIG_DEST}.backup.$(date +%s)"
    mv "$CONFIG_DEST" "$backup_dir"
    log "Moved existing directory to $backup_dir"
  fi

  log "Initializing bare Git repository at $CONFIG_DEST"
  mkdir -p "$(dirname "$CONFIG_DEST")"
  git init --bare --initial-branch=main "$CONFIG_DEST" 2>/dev/null || git init --bare "$CONFIG_DEST"
}

ensure_bare_repo

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

log "Preparing worktree for update..."
git clone "$CONFIG_DEST" "$TMP_DIR/repo" >/dev/null 2>&1
cd "$TMP_DIR/repo"

if git show-ref --verify --quiet refs/heads/main; then
  git checkout main >/dev/null 2>&1
elif git show-ref --verify --quiet refs/heads/master; then
  git branch -M master main >/dev/null 2>&1
  git checkout main >/dev/null 2>&1
else
  git checkout -b main >/dev/null 2>&1
fi

git config user.name "$GIT_USER_NAME"
git config user.email "$GIT_USER_EMAIL"

rsync -av --delete \
  --exclude='.git' \
  --exclude='.DS_Store' \
  --exclude='Thumbs.db' \
  "$CONFIG_SOURCE_DIR/" "$TMP_DIR/repo/" >/dev/null

if git diff --quiet && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
  if git rev-parse --verify HEAD >/dev/null 2>&1; then
    log "No config changes to commit"
  else
    log "Creating initial config commit"
    git commit --allow-empty -m "Initial config" >/dev/null 2>&1
    git push origin main >/dev/null 2>&1
  fi
else
  git add -A
  COMMIT_MSG="Config update $(date '+%Y-%m-%d %H:%M:%S')"
  git commit -m "$COMMIT_MSG" >/dev/null 2>&1
  git push origin main >/dev/null 2>&1
  log "Committed: $COMMIT_MSG"
fi

if git --git-dir="$CONFIG_DEST" show-ref --verify --quiet refs/heads/main; then
  git --git-dir="$CONFIG_DEST" symbolic-ref HEAD refs/heads/main >/dev/null 2>&1 || true
fi

log "Config deployed successfully!"
log "Bare repo: $CONFIG_DEST"
log "Recent commits:"
git --no-pager --git-dir="$CONFIG_DEST" log --oneline -3
