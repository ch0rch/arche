# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Also read `AGENTS.md`** — it contains mandatory code conventions, architecture patterns, security rules, commit format, and the pre-delivery checklist. This file adds deployment context and big-picture architecture that AGENTS.md doesn't cover.

---

## Repository Context

This is a **personal fork** of the original Arche repository, maintained at `ch0rch/arche` on GitHub. The fork is used for self-hosting Arche on a personal Hetzner server.

**Fork workflow:**
- `main` is the active branch, deployed to production automatically via GitHub Actions on every push
- To pull upstream changes: `git fetch upstream && git merge upstream/main`
- The only file that typically needs manual conflict resolution is `apps/web/src/lib/spawner/docker.ts` if we have local patches
- `infra/coolify/` is ignored — we no longer use Coolify

---

## Commands

All commands run from `apps/web/` unless noted.

```bash
pnpm dev                  # Dev server at 0.0.0.0:3000
pnpm build                # Production build
pnpm test                 # Run all tests (Vitest)
pnpm test:watch           # Watch mode
pnpm lint                 # ESLint
pnpm prisma:generate      # Regenerate Prisma client after schema changes
pnpm db:migrate           # Create and apply new migration
pnpm db:seed              # Seed admin user (idempotent)

# Full local stack (from repo root, requires Podman)
podman compose -f infra/compose/compose.yaml up -d --build
podman compose -f infra/compose/compose.yaml down
podman compose -f infra/compose/compose.yaml logs -f web
```

---

## Architecture Overview

Arche is a **single Next.js app** (`apps/web`) that acts as BFF, UI, and container spawner. There is no microservices split — all server logic lives in one Next.js process.

```
Browser
  └─ Next.js (apps/web) ─────────────────────────────┐
       ├─ App Router pages (/w/[slug], /admin, /auth)  │
       ├─ API routes (/api/w/[slug]/chat/stream SSE)   │
       ├─ Server Actions (src/actions/)                │
       ├─ Spawner (src/lib/spawner/) ──► Podman/Docker │
       │     creates/stops workspace containers        │
       ├─ OpenCode client (src/lib/opencode/) ─────────┼─► opencode-{slug}:4096 (workspace container)
       └─ PostgreSQL (via Prisma)                      │
                                                       │
  Workspace containers (one per user)                  │
       ├─ OpenCode process (port 4096)                 │
       ├─ Workspace Agent (Go, port 4097)              │
       ├─ /workspace volume (user files, git repo)     │
       └─ /kb-content bare repo (shared Knowledge Base)│
```

### Key subsystems

**Spawner** (`src/lib/spawner/`): Container lifecycle state machine.
- State: `starting → running → stopped | error`
- `core.ts` orchestrates: create container → wait health → sync providers → mark running
- `docker.ts` wraps the Podman HTTP API (via docker-socket-proxy on port 2375)
- `crypto.ts` encrypts instance passwords with AES-256-GCM using `ARCHE_ENCRYPTION_KEY`
- `reaper.ts` stops idle workspaces after `ARCHE_IDLE_TIMEOUT_MINUTES` (default 30)
- The web container and workspace containers communicate over the `arche_internal` Docker network
- Workspace URL: `http://opencode-{slug}:4096`

**Knowledge Base** (bare Git repos on host):
- `/opt/arche/kb-content` — the shared knowledge base (Obsidian vault), mounted RW in web + all workspaces
- `/opt/arche/kb-config` — config repo (agents JSON, AGENTS.md), mounted RW in web only
- Both are **Git bare repos** on the host, managed by the Ansible deploy
- The web app reads/writes via `src/lib/common-workspace-config-store.ts`
- Kickstart (`apps/web/kickstart/`) populates these repos during first-time setup

**Chat streaming**: `POST /api/w/[slug]/chat/stream` proxies OpenCode SSE events to the browser. Client-side: `useWorkspace` hook in `src/hooks/use-workspace.ts`.

**Connectors**: OAuth 2.1 flow (Linear, Notion) with state encrypted in `ARCHE_CONNECTOR_OAUTH_STATE_SECRET`. Tokens stored AES-encrypted in `Connector.config`. Injected into workspaces as MCP config.

**Auth**: HTTP-only cookie (`arche_session`) → SHA-256 token hash in DB. Argon2 passwords. TOTP 2FA support.

---

## Production Deployment (Hetzner / Ansible)

**Server:** Hetzner CX33 — `arche.rojas.me` (178.104.56.131), Ubuntu 24.04. **No Coolify.**

**How it deploys (fully automatic):**
- Every push to `main` triggers `.github/workflows/build-and-deploy.yml`
- Builds web image → pushes to `ghcr.io/ch0rch/arche/web:<sha>`
- Builds workspace image → pushes to `ghcr.io/ch0rch/arche/workspace:<sha>`
- Runs `infra/deploy/deploy.sh` via Ansible over SSH (key: `arche-ci-deploy`)
- Blue-green deploy: nuevo web container levanta junto al viejo, Traefik lo descubre, el viejo se baja
- Migraciones de DB se aplican automáticamente al iniciar el nuevo container

**Stack en el servidor (Podman):**
- Compose en `/opt/arche/compose.yml`, generado por Ansible
- Proyecto Podman: `arche`
- Comandos útiles en el servidor:
  ```bash
  podman ps                                           # ver contenedores
  podman logs arche-web-<id>                          # logs del web
  podman compose -f /opt/arche/compose.yml -p arche logs -f postgres
  ```

**Persistent data paths (CRÍTICO — no mover ni borrar):**
```
/opt/arche/postgres-data/   # datos de PostgreSQL (bind mount, uid 999)
/opt/arche/kb-content/      # Knowledge Base bare git repo
/opt/arche/kb-config/       # Config repo (agents, AGENTS.md) bare git repo
/opt/arche/users/           # datos de workspaces por usuario
/opt/arche/backups/         # pg_dump pre-deploy automáticos (últimos 10)
```

**Redes:**
- `arche-internal` (Podman network) — web + workspace containers se comunican aquí
- `arche_default` (Podman compose default) — postgres + traefik + socket-proxy

**GitHub Secrets configurados** (en `ch0rch/arche`):
`VPS_HOST`, `VPS_DOMAIN`, `VPS_USER`, `VPS_SSH_KEY`, `ACME_EMAIL`,
`POSTGRES_PASSWORD`, `ARCHE_ENCRYPTION_KEY`, `ARCHE_SESSION_PEPPER`,
`ARCHE_INTERNAL_TOKEN`, `ARCHE_CONNECTOR_OAUTH_STATE_SECRET`,
`ARCHE_GATEWAY_TOKEN_SECRET`, `ARCHE_SEED_ADMIN_EMAIL`,
`ARCHE_SEED_ADMIN_PASSWORD`, `ARCHE_SEED_ADMIN_SLUG`

**Redeploy manual (si es necesario):**
```bash
gh workflow run "Build & Deploy" --repo ch0rch/arche --ref main
```

---

## Database

Schema: `apps/web/prisma/schema.prisma`. Key models: `User`, `Instance`, `Session`, `Connector`, `ProviderCredential`, `AuditEvent`.

**Migration safety (zero-downtime deploys):** Old and new code run simultaneously during deploy. All migrations must be additive. Never `DROP COLUMN` or `RENAME COLUMN` in a single deploy — use the expand-contract pattern (see AGENTS.md).

```bash
# Create migration after schema change
cd apps/web && pnpm db:migrate

# Apply in production (no prompts)
prisma migrate deploy
```

---

## Where Things Go

| Need | Location |
|------|----------|
| UI primitive (button, dialog) | `src/components/ui/` — shadcn/ui, avoid modifying directly |
| Feature component | `src/components/<feature>/` |
| Custom hook | `src/hooks/` |
| Business logic / util | `src/lib/` |
| Server Action | `src/actions/` |
| API route | `src/app/api/<route>/route.ts` |
| Shared type | `src/types/` |
| React Context | `src/contexts/` |
| Test | `<module>/__tests__/<name>.test.ts` |
| Agent catalog entry | `apps/web/kickstart/agents/` |
| KB template | `apps/web/kickstart/templates/definitions/` |
| Infra/compose changes | `infra/` |
| Ansible deploy | `infra/deploy/` |
| Compose template (generado por Ansible) | `infra/deploy/ansible/roles/app/templates/compose.yml.j2` |
