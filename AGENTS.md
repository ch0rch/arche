# AGENTS.md

Guia obligatoria para agentes de codigo (Claude Code, Cursor, OpenCode, etc.) que trabajen en este repositorio. Leela antes de hacer cualquier cambio.

## Que es Arche

Arche es una plataforma de agentes IA especializados con workspaces aislados por usuario. Cada workspace es un contenedor OpenCode con acceso a una Knowledge Base compartida (Obsidian vault) y un catalogo de agentes configurables.

**Componentes principales:**

- `apps/web/` - App Next.js 16 (React 19, TypeScript). Es el BFF (Backend for Frontend), la UI y el spawner de contenedores.
- `config/` - Definiciones de agentes y configuracion de runtime (`CommonWorkspaceConfig.json`).
- `kb/` - Knowledge Base (Obsidian vault). No es codigo; son notas Markdown.
- `infra/` - Infraestructura: Podman Compose, Ansible deployer, imagen del workspace.
- `scripts/` - Scripts de despliegue de KB y config a repositorios bare.

## Stack tecnico

- **Framework:** Next.js 16 + React 19 + TypeScript 5 (strict mode)
- **Estilos:** Tailwind CSS 4 + shadcn/ui (Radix primitives)
- **DB:** PostgreSQL 16 + Prisma 7
- **Auth:** Sesiones HTTP-only con Argon2 + TOTP 2FA
- **Cifrado:** AES-256-GCM para conectores y passwords de instancia
- **Contenedores:** Podman + Traefik + docker-socket-proxy
- **Package manager:** pnpm (no npm, no yarn)
- **Tests:** Vitest 3
- **Lint:** ESLint 9

---

## Reglas generales

### 1. No inventes, pregunta

- Si no encuentras la informacion que necesitas en el codigo o la documentacion, pregunta al usuario.
- No inventes nombres de funciones, endpoints, variables de entorno ni paths que no hayas verificado.
- No asumas que un patron existe: lee el codigo antes de replicarlo.

### 2. Lee antes de escribir

- Siempre lee el fichero que vas a modificar antes de editarlo.
- Entiende el contexto circundante: que hace el modulo, quien lo importa, que patron sigue.
- Revisa los ficheros vecinos para mantener consistencia.

### 3. Minimo cambio necesario

- Haz solo lo que se pide. No refactorices, no "mejores" codigo adyacente, no anadas docstrings ni comentarios donde no se piden.
- No anadas error handling, validaciones ni fallbacks para escenarios que no pueden ocurrir.
- No crees abstracciones prematuras ni helpers para operaciones que ocurren una sola vez.
- Si eliminas algo que ya no se usa, eliminalo por completo (sin `// removed`, sin variables `_unused`, sin re-exports de compatibilidad).

### 4. No rompas lo que funciona

- Ejecuta los tests antes y despues de tus cambios: `pnpm test` desde `apps/web/`.
- Si los tests fallan por tu cambio, arreglalo antes de dar el trabajo por terminado.
- No desactives tests ni hooks de git (`--no-verify`) salvo que el usuario lo pida explicitamente.

---

## Convenciones de codigo

### Nombrado

| Elemento | Convencion | Ejemplo |
|----------|-----------|---------|
| Ficheros | kebab-case | `agent-card.tsx`, `workspace-shell.tsx` |
| Componentes React | PascalCase | `AgentCard`, `WorkspaceShell` |
| Funciones / variables | camelCase | `startInstance`, `isConnected` |
| Tipos / interfaces | PascalCase | `AgentCardProps`, `SpawnerActionResult` |
| Constantes | SCREAMING_SNAKE_CASE | `MIN_LEFT_PX`, `IDLE_TIMEOUT_MS` |
| Hooks | camelCase con prefijo `use` | `useWorkspace`, `useWorkspaceTheme` |

### Imports

Orden obligatorio:

```tsx
// 1. Librerias de React / Next.js
import { useCallback, useState } from 'react'
import { NextRequest, NextResponse } from 'next/server'

// 2. Dependencias externas
import { PrismaClient } from '@prisma/client'

// 3. Imports internos con alias @/
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/hooks/use-workspace'
```

- Usa siempre el alias `@/` para imports internos. Nunca uses rutas relativas como `../../lib/utils`.
- Ordena alfabeticamente dentro de cada grupo.

### Componentes React

```tsx
// Tipo de props encima del componente
type AgentCardProps = {
  displayName: string
  agentId: string
  description?: string
}

export function AgentCard({ displayName, agentId, description }: AgentCardProps) {
  return (/* JSX */)
}
```

- Usa `type` (no `interface`) para props, con sufijo `Props`.
- Exporta funciones nombradas (`export function`), no `export default`.
- Marca componentes cliente con `'use client'` en la primera linea del fichero.
- Marca server actions con `'use server'` en la primera linea.

### Estilos

- Usa clases de Tailwind. No crees CSS custom salvo necesidad real.
- Combina clases con la utilidad `cn()` de `@/lib/utils`:
  ```tsx
  <div className={cn('flex items-center', isActive && 'bg-primary')} />
  ```
- Los componentes UI base (shadcn/ui) viven en `src/components/ui/`. No los modifiques a menos que sea necesario; crea wrappers si hace falta.

### TypeScript

- **Strict mode habilitado.** No uses `any` ni `as` sin justificacion.
- Usa tipos explicitos en fronteras de modulo (exports, API routes, server actions).
- Dentro de implementaciones, deja que TypeScript infiera.
- Usa discriminated unions para resultados con error:
  ```tsx
  type Result =
    | { ok: true; data: Instance }
    | { ok: false; error: string }
  ```

### Manejo de errores

- Devuelve objetos `Result` tipados en vez de lanzar excepciones.
- Valida solo en fronteras del sistema (input de usuario, APIs externas). Confia en el codigo interno.
- No swallees errores: si capturas, anade contexto y reenvialos.

---

## Patrones de arquitectura

### API routes (BFF)

```
/api/u/[slug]/...      → APIs de usuario (agentes, conectores)
/api/w/[slug]/...      → APIs de workspace (chat streaming via SSE)
/api/instances/[slug]/ → Control de instancias (start, stop, restart)
```

- Extraer sesion de cookies con `getSession()`.
- Verificar autorizacion despues de autenticacion.
- Respuestas JSON con codigos HTTP explicitos.
- Errores: `{ error: string }`.

### Server Actions (`src/actions/`)

- Ficheros marcados con `'use server'`.
- Devuelven objetos `Result` tipados, nunca lanzan.
- Nombres descriptivos en camelCase: `startInstance`, `stopInstance`.

### Spawner (ciclo de vida de contenedores)

El spawner en `src/lib/spawner/` gestiona la creacion, salud y destruccion de contenedores:

- `core.ts` - Maquina de estados principal.
- `docker.ts` - Wrapper sobre la API de Podman/Docker.
- `crypto.ts` - Cifrado AES-256-GCM de passwords.
- `reaper.ts` - Daemon de limpieza por inactividad.

No modifiques el spawner sin entender el flujo completo: crear contenedor -> health check -> registrar en DB -> servir.

### Configuracion de agentes

- Fuente de verdad: `config/CommonWorkspaceConfig.json`.
- Tipos: `src/lib/workspace-config.ts`.
- Store: `src/lib/common-workspace-config-store.ts` (lectura/escritura atomica con deteccion de conflictos por hash SHA256).
- El config se despliega a un repo bare de Git y se monta read-only en los contenedores.

### Chat streaming

- Endpoint: `POST /api/w/[slug]/chat/stream`
- Protocolo: Server-Sent Events (SSE)
- Eventos: `status`, `message`, `part`, `agent`, `assistant-meta`, `done`, `error`
- Hook cliente: `useWorkspace` en `src/hooks/use-workspace.ts`

### Base de datos (Prisma)

- Schema: `prisma/schema.prisma`
- Migraciones: `prisma/migrations/`
- Singleton: `src/lib/prisma.ts`
- Para cambios de schema: crea una migracion con `pnpm db:migrate`, nunca edites migraciones existentes.

---

## Seguridad

Estas reglas son **obligatorias** y no se deben ignorar bajo ningun concepto:

- **Nunca commitees secretos:** ni `.env`, ni credenciales, ni claves API, ni tokens.
- **Cifrado:** los conectores y passwords de instancia usan AES-256-GCM. Usa las funciones existentes en `lib/spawner/crypto.ts` y `lib/connectors/`.
- **Sesiones:** tokens hasheados en DB, cookies HTTP-only. No expongas tokens raw.
- **Sanitizacion:** no confies en input de usuario sin validar en fronteras del sistema.
- **Audit:** las acciones sensibles deben crear un `AuditEvent`.
- **Contenedores:** la red `arche-internal` es interna. No expongas puertos de contenedores al host sin pasar por Traefik.
- **OWASP Top 10:** revisa activamente que tu codigo no introduzca XSS, inyeccion SQL, CSRF, etc.

---

## Git y commits

### Formato de commits (Conventional Commits)

```
<type>(<scope>): <descripcion corta>

[cuerpo opcional]
```

**Tipos:**
- `feat` - Nueva funcionalidad
- `fix` - Correccion de bug
- `chore` - Mantenimiento, limpieza
- `refactor` - Reestructuracion sin cambio funcional
- `test` - Tests nuevos o modificados
- `docs` - Documentacion

**Scopes comunes:** `web`, `config`, `infra`, `spawner`, `workspace`, `auth`, `agents`

**Ejemplos:**
```
feat(agents): add temperature slider to agent editor
fix(spawner): handle container timeout on slow networks
chore: remove legacy duplicate files
test(spawner): add health check retry tests
```

### Reglas de Git

- No hagas force push a `main`.
- No uses `--no-verify` salvo peticion explicita del usuario.
- No hagas commit de ficheros que no estan relacionados con tu cambio.
- Crea commits nuevos, no enmiendes commits existentes salvo que se pida.
- Usa `git add <ficheros especificos>` en vez de `git add .` o `git add -A`.

---

## Knowledge Base (KB)

El directorio `kb/` es un vault de Obsidian, **no es codigo**. Si trabajas sobre el:

- Lee `config/AGENTS.md` para las convenciones especificas del vault.
- Ediciones minimas: no reescribas estructura ni tono existente.
- Usa wikilinks (`[[Nota]]`) para enlaces internos.
- Respeta el idioma existente (espanol).
- No introduzcas ficheros de configuracion (`package.json`, etc.) en el vault.

---

## Tests

- Framework: Vitest 3 (configurado en `vitest.config.ts`)
- Ubicacion: junto al codigo en carpetas `__tests__/`
- Nombrado: `<modulo>.test.ts` para unit, `<modulo>.e2e.test.ts` para integracion
- Ejecutar: `pnpm test` (all), `pnpm test:watch` (watch mode)

### Patrones de test

```typescript
describe('startInstance', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns already_running if instance is running', async () => {
    mockPrisma.instance.findUnique.mockResolvedValue(/* ... */)
    const result = await startInstance('alice', 'user-1')
    expect(result).toEqual({ ok: false, error: 'already_running' })
  })
})
```

- Usa `vi.mock()` para dependencias.
- Tests deterministas: sin dependencias de red ni de tiempo.
- Prefiere table-driven tests para multiples casos similares.

---

## Estructura de directorios - Donde va cada cosa

| Necesito... | Lo pongo en... |
|-------------|---------------|
| Un componente de UI reutilizable (boton, dialog, etc.) | `src/components/ui/` |
| Un componente de feature (workspace, agents) | `src/components/<feature>/` |
| Un custom hook | `src/hooks/` |
| Logica de negocio / utilidades | `src/lib/` |
| Un server action | `src/actions/` |
| Un API route | `src/app/api/...` |
| Una pagina | `src/app/<ruta>/page.tsx` |
| Un tipo compartido | `src/types/` |
| Un React Context | `src/contexts/` |
| Un test | `<modulo>/__tests__/<nombre>.test.ts` |
| Config de agentes | `config/CommonWorkspaceConfig.json` |
| Contenido del KB | `kb/` (seguir convenciones de `config/AGENTS.md`) |
| Infra / compose | `infra/` |

---

## Checklist antes de entregar un cambio

- [ ] He leido los ficheros que voy a modificar antes de editarlos.
- [ ] Mi cambio hace solo lo que se pidio, sin extras.
- [ ] Los imports siguen el orden y usan el alias `@/`.
- [ ] Los nombres siguen las convenciones (kebab-case ficheros, PascalCase componentes, etc.).
- [ ] No he introducido `any`, `as unknown`, ni type casts innecesarios.
- [ ] No he introducido vulnerabilidades de seguridad (XSS, inyeccion, secretos expuestos).
- [ ] Los tests pasan: `pnpm test`.
- [ ] El linter pasa: `pnpm lint`.
- [ ] El commit sigue Conventional Commits.
- [ ] No he commiteado ficheros sensibles (`.env`, credenciales, claves).

---

## Comandos rapidos

```bash
# Desde apps/web/
pnpm dev                    # Dev server (0.0.0.0:3000)
pnpm build                  # Build de produccion
pnpm test                   # Ejecutar tests
pnpm test:watch             # Tests en modo watch
pnpm lint                   # Lint
pnpm prisma:generate        # Regenerar cliente Prisma
pnpm db:migrate             # Crear migracion
pnpm db:seed                # Seed de datos iniciales

# Stack completo (desde raiz)
podman compose -f infra/compose/compose.yaml up -d --build
podman compose -f infra/compose/compose.yaml down
podman compose -f infra/compose/compose.yaml logs -f web
```
