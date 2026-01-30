# Auth + sesiones + forwardAuth (BFF)

- Asignado a: [[Company/People/Inaki Tajes|Iñaki Tajes]]
- Estado: Por hacer

## Objetivo

Implementar autenticación local y sesiones seguras en el BFF, incluyendo el endpoint de autorización por host para Traefik (`forwardAuth`).

## Entregables mínimos

- [ ] Modelo de datos (mínimo): `users`, `sessions`, `audit_events` (y placeholders opcionales para 2FA)
- [ ] `POST /auth/login` (email+password) -> crea sesión + cookie `httpOnly`
- [ ] `POST /auth/logout` -> revoca sesión
- [ ] `GET /auth/traefik` -> valida cookie + `X-Forwarded-Host` y aplica owner isolation (`u-<slug>.<domain>`)
- [ ] Seed: crear primer admin (y/o usuario de prueba)

## Contratos a respetar (para no pisarnos)

- `users.slug` es la fuente de verdad para `u-<slug>.<domain>`
- `GET /auth/traefik` responde `200` si autorizado; `401/403` si no

## Dependencias

- Coordinación con [[Arche/Tasks/Alberto Perdomo - Infra y edge|Infra/edge]] para headers reales (`X-Forwarded-Host`) y wiring de `forwardAuth`
- Coordinación con [[Arche/Tasks/Jose Miguel Hernandez - Spawner y runtime|Spawner]] para el modelo/tabla de `instances` (si se consulta desde UI)
