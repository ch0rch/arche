# Arche Workspace Image

Imagen derivada de OpenCode con soporte para Knowledge Base (KB) compartido.

## Características

- Basada en `ghcr.io/anomalyco/opencode`
- Incluye `git` para sincronización de KB
- Script de inicialización automática del workspace
- Workspace agent HTTP para diffs y operaciones de archivo
- Generación de `opencode.json` desde repositorio de configuración

## Workspace Agent

Servicio interno que expone operaciones acotadas sobre el workspace:

- `GET /git/diffs`
- `POST /files/read`
- `POST /files/write`
- `POST /files/delete`
- `POST /files/apply_patch`
- `POST /kb/sync`
- `GET /kb/status`
- `POST /kb/publish`

## Build

```bash
# Desde este directorio
podman build -t arche-workspace .

# Con versión específica de OpenCode
podman build --build-arg OPENCODE_VERSION=1.1.45 -t arche-workspace:1.1.45 .
```

## Uso

El container espera dos volúmenes:

1. `/workspace` - Volumen persistente del usuario (read-write)
2. `/kb-content` - Repo Git bare de contenido KB (read-write)
3. `/kb-config` - Repo Git bare de configuración (read-only para runtime)

```bash
podman run -d \
  -v workspace-user1:/workspace \
  -v /opt/arche/kb-content:/kb-content \
  -v /opt/arche/kb-config:/kb-config \
  arche-workspace serve --hostname 0.0.0.0 --port 4096
```

## Inicialización del Workspace

Al iniciar, el script `init-workspace.sh` ejecuta:

1. Si `/workspace` no tiene `.git` y está vacío:
   - Clona el repo bare de `/kb-content` a `/workspace`
   - Configura el remote `kb` apuntando a `/kb-content`

2. Si `/workspace` ya tiene `.git`:
   - No clona nada (respeta el trabajo del usuario)
   - Añade remote `kb` si no existe

Luego se generan archivos runtime desde `/kb-config`:

- `opencode.json`
- `AGENTS.md` (si existe en el repo de config)

## Sincronización de KB

Desde dentro del container, el usuario puede sincronizar con:

```bash
cd /workspace
git fetch kb
git merge kb/main  # o git rebase kb/main
```

Si hay conflictos, Git los marcará y el usuario puede resolverlos.

## Variables de Entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `WORKSPACE_DIR` | `/workspace` | Directorio del workspace |
| `KB_CONTENT_DIR` | `/kb-content` | Repo bare de contenido KB montado |
| `KB_CONFIG_DIR` | `/kb-config` | Repo bare de configuración montado |
| `KB_REMOTE_NAME` | `kb` | Nombre del remote Git para el KB |
| `WORKSPACE_AGENT_PORT` | `4097` | Puerto del workspace agent |
| `WORKSPACE_AGENT_ADDR` | `0.0.0.0:4097` | Dirección bind del workspace agent |
