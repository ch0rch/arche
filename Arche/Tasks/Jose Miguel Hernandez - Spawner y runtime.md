# Spawner + runtime OpenCode (Docker)

- Asignado a: [[Company/People/Jose Miguel Hernandez|José Miguel Hernández]]
- Estado: Por hacer

## Objetivo

Implementar el “Spawner” para crear/parar instancias `opencode-<slug>` por usuario, con credenciales y networking interno seguro.

## Entregables mínimos

- [ ] Interfaz estable: `start(slug)`, `stop(slug)`, `status(slug)` (aunque viva dentro del BFF al inicio)
- [ ] Plantilla runtime `opencode-<slug>` ejecutando `opencode serve`
- [ ] Generación y persistencia de `OPENCODE_SERVER_PASSWORD` por instancia
- [ ] Contenedor accesible solo en red Docker interna (no expuesto a Internet)
- [ ] Modelo de datos mínimo: `instances` (estado, timestamps, credenciales/runtime metadata)

## Contratos a respetar (para no pisarnos)

- Estados de instancia: `starting` / `running` / `stopped` / `error`
- El BFF nunca habla con Docker directo: usa `docker-socket-proxy`

## Dependencias

- Coordinación con [[Arche/Tasks/Alberto Perdomo - Infra y edge|Infra/edge]] para redes Docker, socket proxy y compose
- Coordinación con [[Arche/Tasks/Inaki Tajes - Auth y sesiones|Auth/sesiones]] si el spawner depende del `users.slug` y de la sesión actual
