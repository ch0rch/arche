# OpenCode Provider Gateway Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Permitir que OpenCode use OpenAI/Anthropic/OpenRouter vía un gateway interno con credenciales por usuario, sin secretos reales en el contenedor y con rotación sin reinicio.

**Architecture:** OpenCode apunta a un `baseURL` interno por proveedor; el BFF emite un token interno efímero y el gateway valida, recupera credenciales cifradas en DB y llama al proveedor real.

**Tech Stack:** Next.js App Router, Prisma/Postgres, Docker/Podman, OpenCode SDK, Vitest.

---

### Task 1: Veredicto oficial de OpenAI Auth

**Files:**
- Modify: `docs/plans/2026-02-05-credenciales-proveedores-design.md`

**Step 1: Documentar fuente oficial**

- Revisar documentación oficial de OpenAI sobre “Sign in with OpenAI/ChatGPT subscription” y uso de API.
- Registrar en el diseño un veredicto explícito (viable/no viable) con fuente y fecha.

**Step 2: Alinear alcance**

- Marcar el flujo de suscripción/OAuth como fuera de alcance y mantener API key como único camino.

---

### Task 2: Tipos y cifrado de credenciales de proveedor

**Files:**
- Create: `apps/web/src/lib/providers/types.ts`
- Create: `apps/web/src/lib/providers/crypto.ts`
- Test: `apps/web/tests/providers-crypto.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { encryptProviderSecret, decryptProviderSecret } from '@/lib/providers/crypto'

describe('providers/crypto', () => {
  it('round-trips secrets', () => {
    const encrypted = encryptProviderSecret({ apiKey: 'sk-123' })
    expect(decryptProviderSecret(encrypted)).toEqual({ apiKey: 'sk-123' })
  })

  it('rejects corrupted secrets', () => {
    expect(() => decryptProviderSecret('bad:data:here')).toThrow('Failed to decrypt provider secret')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/providers-crypto.test.ts`
Expected: FAIL (module not found)

**Step 3: Write minimal implementation**

`apps/web/src/lib/providers/types.ts`

```ts
export const PROVIDERS = ['openai', 'anthropic', 'openrouter'] as const
export type ProviderId = (typeof PROVIDERS)[number]

export type ProviderCredentialType = 'api'

export type ApiSecret = { apiKey: string }
export type ProviderSecret = ApiSecret
```

`apps/web/src/lib/providers/crypto.ts`

```ts
import { encryptPassword, decryptPassword } from '@/lib/spawner/crypto'
import type { ProviderSecret } from './types'

const MAX_SECRET_SIZE = 16 * 1024

export function encryptProviderSecret(secret: ProviderSecret): string {
  const json = JSON.stringify(secret)
  if (json.length > MAX_SECRET_SIZE) {
    throw new Error('Provider secret exceeds maximum size')
  }
  return encryptPassword(json)
}

export function decryptProviderSecret(encrypted: string): ProviderSecret {
  try {
    return JSON.parse(decryptPassword(encrypted)) as ProviderSecret
  } catch {
    throw new Error('Failed to decrypt provider secret')
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/providers-crypto.test.ts`
Expected: PASS

**Step 5: Commit**

`git add apps/web/src/lib/providers/types.ts apps/web/src/lib/providers/crypto.ts apps/web/tests/providers-crypto.test.ts`
`git commit -m "feat: add provider secret crypto"`

---

### Task 3: Config y tokens internos del gateway

**Files:**
- Create: `apps/web/src/lib/providers/config.ts`
- Create: `apps/web/src/lib/providers/tokens.ts`
- Test: `apps/web/tests/providers-tokens.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { issueGatewayToken, verifyGatewayToken } from '@/lib/providers/tokens'

describe('providers/tokens', () => {
  it('issues and verifies tokens', () => {
    const token = issueGatewayToken({ userId: 'u1', workspaceSlug: 'alice', providerId: 'openai', version: 1 })
    const payload = verifyGatewayToken(token)
    expect(payload.userId).toBe('u1')
    expect(payload.providerId).toBe('openai')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/providers-tokens.test.ts`
Expected: FAIL (module not found)

**Step 3: Write minimal implementation**

`apps/web/src/lib/providers/config.ts`

```ts
import type { ProviderId } from './types'

const DEFAULT_GATEWAY_BASE_URL = 'http://web:3000/api/internal/providers'

export function getGatewayTokenSecret(): string {
  const secret = process.env.ARCHE_GATEWAY_TOKEN_SECRET
  if (secret) return secret
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ARCHE_GATEWAY_TOKEN_SECRET is required in production')
  }
  return 'dev-insecure-gateway-secret'
}

export function getGatewayTokenTtlSeconds(): number {
  const raw = process.env.ARCHE_GATEWAY_TOKEN_TTL_SECONDS
  const parsed = raw ? Number(raw) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 900
}

export function getGatewayBaseUrlForProvider(providerId: ProviderId): string {
  const base = process.env.ARCHE_GATEWAY_BASE_URL || DEFAULT_GATEWAY_BASE_URL
  const normalized = base.endsWith('/') ? base.slice(0, -1) : base
  return `${normalized}/${providerId}`
}
```

`apps/web/src/lib/providers/tokens.ts`

```ts
import crypto from 'node:crypto'
import { getGatewayTokenSecret, getGatewayTokenTtlSeconds } from './config'
import type { ProviderId } from './types'

export type GatewayTokenPayload = {
  userId: string
  workspaceSlug: string
  providerId: ProviderId
  version: number
  exp: number
}

function base64url(input: string) {
  return Buffer.from(input).toString('base64url')
}

function sign(data: string) {
  return crypto.createHmac('sha256', getGatewayTokenSecret()).update(data).digest('base64url')
}

export function issueGatewayToken(args: Omit<GatewayTokenPayload, 'exp'>): string {
  const exp = Math.floor(Date.now() / 1000) + getGatewayTokenTtlSeconds()
  const payload: GatewayTokenPayload = { ...args, exp }
  const body = base64url(JSON.stringify(payload))
  return `${body}.${sign(body)}`
}

export function verifyGatewayToken(token: string): GatewayTokenPayload {
  const [body, sig] = token.split('.')
  if (!body || !sig || sign(body) !== sig) {
    throw new Error('invalid_token')
  }
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as GatewayTokenPayload
  if (payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error('token_expired')
  }
  return payload
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/providers-tokens.test.ts`
Expected: PASS

**Step 5: Commit**

`git add apps/web/src/lib/providers/config.ts apps/web/src/lib/providers/tokens.ts apps/web/tests/providers-tokens.test.ts`
`git commit -m "feat: add gateway token helpers"`

---

### Task 4: Esquema de credenciales y store

**Files:**
- Modify: `apps/web/prisma/schema.prisma`
- Create: `apps/web/src/lib/providers/store.ts`
- Test: `apps/web/tests/providers-store.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    providerCredential: {
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

import { createApiCredential } from '@/lib/providers/store'

describe('providers/store', () => {
  it('creates api credentials for a user', async () => {
    await expect(createApiCredential({ userId: 'u1', providerId: 'openai', apiKey: 'sk-1' })).resolves.toBeDefined()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/providers-store.test.ts`
Expected: FAIL (module not found)

**Step 3: Write minimal implementation**

`apps/web/prisma/schema.prisma`

```prisma
enum ProviderCredentialStatus {
  enabled
  disabled
}

model ProviderCredential {
  id           String   @id @default(cuid())
  userId       String   @map("user_id")
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  providerId   String   @map("provider_id")
  type         String   @map("type")
  status       ProviderCredentialStatus @default(enabled)
  version      Int      @default(1)

  secret       String   @map("secret") // AES-256-GCM encrypted JSON
  lastError    String?  @map("last_error")
  lastUsedAt   DateTime? @map("last_used_at")

  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  @@index([userId])
  @@index([providerId])
  @@map("provider_credentials")
}
```

`apps/web/src/lib/providers/store.ts`

```ts
import { prisma } from '@/lib/prisma'
import { encryptProviderSecret } from './crypto'
import type { ProviderId } from './types'

export async function createApiCredential(args: { userId: string; providerId: ProviderId; apiKey: string }) {
  const secret = encryptProviderSecret({ apiKey: args.apiKey })
  return prisma.providerCredential.create({
    data: {
      userId: args.userId,
      providerId: args.providerId,
      type: 'api',
      secret,
    },
  })
}

export async function getActiveCredentialForUser(args: { userId: string; providerId: ProviderId }) {
  return prisma.providerCredential.findFirst({
    where: { userId: args.userId, providerId: args.providerId, status: 'enabled' },
    select: { id: true, type: true, secret: true, version: true },
  })
}
```

**Step 3.5: Crear migración**

Run: `pnpm prisma migrate dev --name provider_credentials`
Expected: new folder in `apps/web/prisma/migrations/` + migration applied

**Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/providers-store.test.ts`
Expected: PASS

**Step 5: Commit**

`git add apps/web/prisma/schema.prisma apps/web/src/lib/providers/store.ts apps/web/tests/providers-store.test.ts`
`git commit -m "feat: add provider credential store"`

---

### Task 5: API de credenciales por usuario/proveedor (admin)

**Files:**
- Create: `apps/web/src/app/api/u/[slug]/providers/route.ts`
- Create: `apps/web/src/app/api/u/[slug]/providers/[provider]/route.ts`
- Test: `apps/web/tests/providers-routes.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest'

const mockSession = vi.fn()
vi.mock('@/lib/auth', () => ({
  getAuthenticatedUser: () => mockSession(),
}))

describe('GET /api/u/[slug]/providers', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession.mockResolvedValue(null)
    const { GET } = await import('@/app/api/u/[slug]/providers/route')
    const res = await GET(new Request('http://localhost') as never, { params: Promise.resolve({ slug: 'alice' }) })
    expect(res.status).toBe(401)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/providers-routes.test.ts`
Expected: FAIL (route not found)

**Step 3: Write minimal implementation**

`apps/web/src/app/api/u/[slug]/providers/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const session = await getAuthenticatedUser()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { slug } = await params
  if (session.user.slug !== slug && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  return NextResponse.json({ providers: [] })
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/providers-routes.test.ts`
Expected: PASS

**Step 5: Commit**

`git add apps/web/src/app/api/u/[slug]/providers/route.ts apps/web/tests/providers-routes.test.ts`
`git commit -m "feat: add providers list route"`

---

### Task 6: Gateway interno compatible con OpenAI/Anthropic/OpenRouter

**Files:**
- Create: `apps/web/src/app/api/internal/providers/[provider]/[...path]/route.ts`
- Test: `apps/web/tests/providers-gateway.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/providers/tokens', () => ({
  verifyGatewayToken: () => ({ userId: 'u1', workspaceSlug: 'alice', providerId: 'openai', version: 1, exp: Date.now() / 1000 + 60 }),
}))

vi.mock('@/lib/providers/store', () => ({
  getActiveCredentialForUser: () => ({ type: 'api', secret: { apiKey: 'sk-real' } }),
}))

describe('gateway proxy', () => {
  it('proxies request to provider base', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('ok', { status: 200 })))
    const { POST } = await import('@/app/api/internal/providers/[provider]/[...path]/route')
    const req = new Request('http://localhost/api/internal/providers/openai/v1/models', {
      method: 'POST',
      headers: { Authorization: 'Bearer token' },
    })
    const res = await POST(req as never, { params: Promise.resolve({ provider: 'openai', path: ['v1', 'models'] }) })
    expect(res.status).toBe(200)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/providers-gateway.test.ts`
Expected: FAIL (route not found)

**Step 3: Write minimal implementation**

Crear un proxy que:
- extraiga el token interno desde `Authorization` (OpenAI/OpenRouter) o `x-api-key` (Anthropic),
- valide token,
- recupere credencial real del usuario,
- reemplace headers de auth y haga `fetch` al proveedor real,
- devuelva `Response` con streaming intacto.

**Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/providers-gateway.test.ts`
Expected: PASS

**Step 5: Commit**

`git add apps/web/src/app/api/internal/providers/[provider]/[...path]/route.ts apps/web/tests/providers-gateway.test.ts`
`git commit -m "feat: add provider gateway proxy"`

---

### Task 7: Sincronizar OpenCode (config + auth) al arrancar

**Files:**
- Create: `apps/web/src/lib/opencode/providers.ts`
- Modify: `apps/web/src/lib/spawner/core.ts`
- Test: `apps/web/tests/opencode-providers.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest'

const mockClient = { config: { update: vi.fn() }, auth: { set: vi.fn() } }
vi.mock('@/lib/opencode/client', () => ({ createInstanceClient: async () => mockClient }))

describe('opencode/providers', () => {
  it('sets baseURL and auth tokens', async () => {
    const { syncProviderAccessForInstance } = await import('@/lib/opencode/providers')
    await syncProviderAccessForInstance({ slug: 'alice', userId: 'u1' })
    expect(mockClient.config.update).toHaveBeenCalled()
    expect(mockClient.auth.set).toHaveBeenCalled()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/opencode-providers.test.ts`
Expected: FAIL (module not found)

**Step 3: Write minimal implementation**

`apps/web/src/lib/opencode/providers.ts`

```ts
import { createInstanceClient } from './client'
import { issueGatewayToken } from '@/lib/providers/tokens'
import { getGatewayBaseUrlForProvider } from '@/lib/providers/config'

export async function syncProviderAccessForInstance(args: { slug: string; userId: string }) {
  const client = await createInstanceClient(args.slug)
  if (!client) return

  await client.config.update({
    provider: {
      openai: { options: { baseURL: getGatewayBaseUrlForProvider('openai') } },
      anthropic: { options: { baseURL: getGatewayBaseUrlForProvider('anthropic') } },
    },
    enabled_providers: ['openai', 'anthropic'],
  })

  const openaiToken = issueGatewayToken({ userId: args.userId, workspaceSlug: args.slug, providerId: 'openai', version: 1 })
  await client.auth.set({ path: { id: 'openai' }, body: { type: 'api', key: openaiToken } })
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/opencode-providers.test.ts`
Expected: PASS

**Step 5: Commit**

`git add apps/web/src/lib/opencode/providers.ts apps/web/src/lib/spawner/core.ts apps/web/tests/opencode-providers.test.ts`
`git commit -m "feat: sync opencode provider access"`

---

### Task 9: Variables de entorno y despliegue

**Files:**
- Modify: `infra/compose/compose.yaml`
- Modify: `infra/deploy/ansible/roles/app/templates/compose.yml.j2`
- Modify: `apps/web/.env.example`

**Step 1: Añadir env vars**

- `ARCHE_GATEWAY_TOKEN_SECRET`
- `ARCHE_GATEWAY_TOKEN_TTL_SECONDS`
- `ARCHE_GATEWAY_BASE_URL` (o por proveedor)

**Step 2: Verificar configuración local**

Run: `pnpm test -- tests/providers-tokens.test.ts`
Expected: PASS

**Step 3: Commit**

`git add infra/compose/compose.yaml infra/deploy/ansible/roles/app/templates/compose.yml.j2 apps/web/.env.example`
`git commit -m "chore: document gateway env vars"`

---

## Notas de implementación

- El gateway debe respetar streaming; devolver `Response` con el cuerpo del `fetch` original.
- El token interno debe expirar rápido y ser revocable (versionado en DB).
- No registrar secretos en logs.

## Comandos útiles

- Tests unitarios: `pnpm test`
- Test específico: `pnpm test -- tests/providers-gateway.test.ts`
