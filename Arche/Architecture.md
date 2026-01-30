# Arquitectura de Arche

## Objetivo

Arche es un sistema multiusuario que levanta instancias aisladas de OpenCode bajo demanda en un VPS, con:

- Autenticación y control de acceso autocontenidos.
- UI web propia (client-first) para operar la experiencia de usuario
- Knowledge Base persistida como Git local en el VPS en estructura de fichero markdown.
- Metadatos (usuarios/instancias/config) en una DB local en contenedor
- Integración con OpenCode en modo headless (`opencode serve`) a traves de su OpenAPI

## Requisitos

### Requisitos externos (minimos)

- Un VPS Linux (Ubuntu 22.04+ recomendado) con Docker
- Un dominio con:
  - `ARCHE_DOMAIN` (p.ej. `arche.example.com`) apuntando al VPS
  - wildcard `*.ARCHE_DOMAIN` (p.ej. `*.arche.example.com`) apuntando al VPS

### Requisitos funcionales

- Login local (usuarios + roles) y sesiones seguras
- Aislamiento por usuario:
  - Cada usuario tiene su propio contenedor OpenCode
  - Cada usuario solo puede acceder a su subdominio `u-<slug>.<ARCHE_DOMAIN>`
- Provisionamiento on-demand (start/stop) y lifecycle (idle/TTL)
- La KB se clona a un workspace por usuario al iniciar una instancia
- Auditoria basica: login/logout, start/stop, errores del runtime

### Requisitos no funcionales

- “One VPS, self-contained”: sin dependencias SaaS obligatorias
- Seguridad por defecto:
  - TLS obligatorio en el edge
  - OpenCode no expuesto directamente a Internet
  - Principio de minimo privilegio para acceso a Docker
- Backups recuperables (DB + Git KB + datos de usuarios)

## Componentes (v1)

```
Internet
  │
  ▼
┌───────────────────────────┐
│ Reverse Proxy (Traefik)   │  TLS (ACME), routing, rate limits
│ + forwardAuth             │  authZ por host/subdominio
└───────────────┬───────────┘
                │
      ┌─────────┴──────────────────────────────────────────┐
      │                                                    │
      ▼                                                    ▼
arche.<domain>                                      u-<slug>.<domain>
┌───────────────────────────┐                      ┌───────────────────┐
│ Arche Web (Next.js)       │                      │ Arche Web (Next.js)│
│ - UI (operaciones + user) │                      │ - UI user          │
│ - BFF/API (server actions │◄──────────────┐       │ - SSE/streaming UI │
│   o routes)               │               │       └───────────────────┘
└───────────────┬───────────┘               │
                │                           │
                ▼                           │
        ┌───────────────┐                   │
        │ Postgres       │                   │
        │ + Prisma       │                   │
        └───────────────┘                   │
                                            │
                                            ▼
                                     ┌───────────────┐
                                     │ OpenCode serve │  (1 por usuario)
                                     │ opencode-<slug>│  OpenAPI + SSE
                                     └───────────────┘

Persistencia host:
  /var/lib/arche/kb/vault.git   (repo bare)
  /var/lib/arche/users/<slug>/  (workspace + datos opencode)
```

### Reverse Proxy (Traefik)

- Termina TLS con Lets Encrypt (ACME)
- Enruta por Host:
  - `arche.<domain>` -> Arche Web
  - `u-<slug>.<domain>` -> Arche Web (misma app, distinta superficie)
- Aplica `forwardAuth` hacia el backend de Arche para autorizar por sesion y validar owner isolation

### Arche Web (Next.js)

Una unica aplicacion que incluye:

- UI (admin y usuario)
- Backend-for-Frontend (BFF): API interna para:
  - autenticar
  - operar instancias
  - proxyear llamadas hacia OpenCode (OpenAPI + SSE)

### Orquestador de instancias (Spawner)

Responsable de:

- Crear/parar `opencode-<slug>`
- Montar el workspace del usuario y config dirs
- Gestionar lifecycle (idle reaper, TTL)

Implementacion:

- El BFF llama al API de Docker via `docker-socket-proxy` (no acceso directo a `/var/run/docker.sock`)
- Los contenedores OpenCode solo son accesibles en la red Docker interna

### OpenCode runtime (headless)

- Cada usuario corre `opencode serve` en su contenedor
- Se protege en red interna con basic auth por instancia:
  - `OPENCODE_SERVER_USERNAME` (default `opencode`)
  - `OPENCODE_SERVER_PASSWORD` (generado por instancia)

Integracion:

- Arche consume el OpenAPI expuesto por OpenCode (`/doc`) y opera mediante HTTP + SSE (`/event`)
- Opcional: usar `@opencode-ai/sdk` en el backend para tipado/ergonomia

### Datos

- Postgres (container) para: usuarios, roles, instancias, configuracion, audit events
- Prisma para: schema, migraciones, seeds
- Git bare para KB:
  - `vault.git` como source of truth
  - clones por usuario en `users/<slug>/vault` (idealmente con `--shared/--local` cuando aplique)

## Seguridad (modelo)

- TLS obligatorio en el edge
- Autenticacion local con sesiones httpOnly (backend)
- Autorizacion por host:
  - `forwardAuth` valida sesion
  - extrae slug del Host
  - permite solo si `current_user.slug == slug`
- Defensa en profundidad:
  - OpenCode no expuesto a Internet
  - Basic auth para `opencode serve` en red interna
  - docker-socket-proxy con permisos minimos

## Herramientas

- UI/BFF: Next.js + TypeScript
- DB: Postgres
- ORM/migraciones: Prisma
- Reverse proxy: Traefik
- Runtime: Docker
- Docker security: `tecnativa/docker-socket-proxy`
- OpenCode: imagen base oficial + `opencode serve`
- Git: repo bare + clones por usuario

## Plan de implementacion (orden recomendado)

1) Skeleton del repositorio (solo arquitectura + decisiones)
   - Estandarizar variables `ARCHE_*` y rutas `/var/lib/arche/*`

2) Core BFF (Next.js)
   - Login local + sesiones
   - RBAC minimo (admin/user)

3) Data layer (Postgres + Prisma)
   - Modelos: users, instances, audit_events, kb
   - Migraciones + seed (primer admin)

4) Spawner (Docker)
   - API para start/stop/status
   - docker-socket-proxy
   - lifecycle (idle/TTL)

5) Git KB workflow
   - Inicializar repo bare
   - Estrategia de clon por usuario
   - Politica de sync/merge (definir conflicto/resolucion)

6) Integracion OpenCode headless
   - Levantar `opencode serve` por usuario
   - Proxy BFF para OpenAPI + SSE
   - UI: sesiones, streaming, acciones basicas

7) Hardening y operabilidad
   - Rate limits
   - Logs/auditoria
   - Estrategia de backups (requisito, no script en esta fase)

## Distribucion de ownership (equipo 3)

- Infra: Traefik/TLS, Docker hardening, networking, backups (definicion)
- Generalista: BFF backend, Prisma/Postgres, spawner, Git KB
- Web/UI: UI Next.js (user experience + operaciones), streaming y estados
