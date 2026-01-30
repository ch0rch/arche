# Arche Web (Next.js)

Este directorio contiene la app web de Arche (UI + BFF) y la implementación de autenticación/sesiones para `forwardAuth`.

## Requisitos

- Node.js + npm
- Postgres (local o en Docker)

## Setup rápido (local)

1) Variables de entorno

- Copia `apps/web/.env.example` a `apps/web/.env` y ajusta:
  - `DATABASE_URL`
  - `ARCHE_DOMAIN` (ej: `arche.example.com`)
  - `ARCHE_SESSION_PEPPER` (en local puede ser cualquier string; en producción debe ser secreto)

2) Instalar dependencias

```bash
cd apps/web
npm install
```

3) Migraciones + seed

```bash
cd apps/web
npx prisma migrate dev --name init
npm run db:seed
```

4) Levantar la app

```bash
cd apps/web
npm run dev
```

## Endpoints de auth

- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/traefik` (para Traefik `forwardAuth`)

### Verificación manual (curl)

Login (captura el `Set-Cookie`):

```bash
curl -i \
  -X POST "http://localhost:3000/auth/login" \
  -H "content-type: application/json" \
  -d '{"email":"admin@example.com","password":"change-me"}'
```

Traefik auth (ejemplo con cookie copiada de la respuesta anterior):

```bash
curl -i \
  "http://localhost:3000/auth/traefik" \
  -H "X-Forwarded-Host: u-admin.arche.example.com" \
  --cookie "arche_session=<pega_aqui_el_valor_del_cookie>"
```

Logout:

```bash
curl -i \
  -X POST "http://localhost:3000/auth/logout" \
  --cookie "arche_session=<pega_aqui_el_valor_del_cookie>"
```
