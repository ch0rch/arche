# Knowledge Base Architecture

Este documento describe la arquitectura del Knowledge Base (KB) compartido en Arche.

## Objetivo

Proveer una base de conocimiento común a todos los workspaces de usuario que incluye:

- Documentación de producto
- Guías de estilo y brand
- Plantillas operativas

## Componentes

### 1. Directorio `kb/` (contenido)

Contiene el contenido maestro del KB:

```
kb/
├── Company/           # Identidad, voz, glosario, docs de producto
├── Templates/         # Plantillas operativas (PRD, KB entry, etc.)
├── .gitignore         # Excluye me.txt, .obsidian/, etc.
└── README.md          # Documentación del KB
```

### 2. Directorio `config/` (control plane)

```
config/
├── CommonWorkspaceConfig.json  # Fuente de verdad de agentes y prompts inline
└── AGENTS.md                   # Instrucciones del agente runtime
```

### 3. Imagen `arche-workspace`

Imagen Docker derivada de OpenCode que incluye:

- Git (para sync)
- Script de inicialización del workspace

Ubicación: `infra/workspace-image/`

### 4. Scripts de deploy

Despliegan contenido y configuración al host de producción:

```bash
./scripts/deploy-kb.sh /opt/arche/kb-content
./scripts/deploy-config.sh /opt/arche/kb-config
```

Los scripts:
1. Inicializa un repo Git bare si no existe
2. Sincronizan `kb/` (contenido) y `config/` (config runtime) vía commit
3. Empujan cambios a cada repo bare

### 5. Spawner modificado

El spawner (`apps/web/src/lib/spawner/`) monta el KB en cada container:

```typescript
// docker.ts
const binds = [`${volumeName}:/workspace`]
if (kbContentHostPath) {
  binds.push(`${kbContentHostPath}:/kb-content`)  // bare repo (read-write)
}
if (kbConfigHostPath) {
  binds.push(`${kbConfigHostPath}:/kb-config`)    // bare repo (read-only runtime)
}
```

### 6. Endpoint de sync

`POST /api/instances/[slug]/sync-kb`

Ejecuta en el container:
```bash
git fetch kb
git merge kb/main
```

Respuestas posibles:
- `{ status: 'synced' }` - Merge exitoso
- `{ status: 'conflicts', conflicts: [...] }` - Hay conflictos
- `{ status: 'error', message: '...' }` - Error

### 7. UI de sync

Botón "Sync KB" en el workspace header que:
- Llama al endpoint de sync
- Muestra estado (syncing, synced, conflicts, error)
- Lista archivos en conflicto si los hay

## Flujo de datos

```
┌─────────────────┐
│   Monorepo      │
│   kb/ + config/ │ ─── deploy scripts ─▶ /opt/arche/kb-content + /opt/arche/kb-config
└─────────────────┘                           │
                                              │ mount :ro
                                              ▼
┌─────────────────────────────────────────────────────────┐
│  Container (workspace usuario)                          │
│  ┌──────────────┐    init     ┌──────────────────────┐ │
│  │ /kb-content  │ ──────────▶ │  /workspace          │ │
│  │ (bare repo)  │   clone     │  (read-write)        │ │
│  └──────────────┘             │  ├── .git/           │ │
│                               │  │   remote: kb=/kb-content │ │
│                               │  ├── Company/        │ │
│                               │  └── ...             │ │
│                               └──────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Inicialización del workspace

Al crear un container nuevo (`init-workspace.sh`):

1. Si `/workspace/.git` **no existe**:
   - Clona el repo bare de `/kb-content` a `/workspace`
   - Configura el remote `kb` apuntando a `/kb-content`

2. Si `/workspace/.git` **ya existe**:
   - No copia nada (respeta el trabajo del usuario)
   - Añade remote `kb` si no existe

## Sincronización

El usuario puede sincronizar su workspace con el KB central de dos formas:

### Desde la UI

Clic en el botón "Sync KB" en el header del workspace.

### Manualmente (terminal)

```bash
cd /workspace
git fetch kb
git merge kb/main
```

### Resolución de conflictos

Si el merge genera conflictos:

1. La UI muestra la lista de archivos en conflicto
2. El usuario abre cada archivo en el editor
3. Resuelve los conflictos (marcados con `<<<<<<<`, `=======`, `>>>>>>>`)
4. Guarda los archivos
5. Ejecuta `git add <archivo>` y `git commit` (o repite el sync)

## Variables de entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `KB_CONTENT_HOST_PATH` | - | Path al repo bare de contenido KB (ej: `/opt/arche/kb-content`) |
| `KB_CONFIG_HOST_PATH` | - | Path al repo bare de configuración (ej: `/opt/arche/kb-config`) |
| `OPENCODE_IMAGE` | `ghcr.io/anomalyco/opencode:1.1.45` | Imagen de workspace (usar `arche-workspace:latest`) |

## Consideraciones de seguridad

- El contenido KB se monta como repo bare **read-write** en los containers
- La configuración runtime se monta desde un repo separado (`kb-config`)
- Los cambios locales quedan en el volumen del usuario
- El endpoint de sync requiere autenticación
- Los cambios se empujan al repo central con "Publish KB"

## Actualización del KB

Para actualizar el KB en producción:

1. Edita los archivos en `kb/`
2. Haz commit y push al monorepo
3. En el servidor, ejecuta `deploy-kb.sh` y `deploy-config.sh`
4. Los usuarios sincronizan manualmente (botón "Sync KB")
5. Para cambios desde workspaces, usa "Publish KB"

## Troubleshooting

### El workspace no tiene el KB

Verifica que:
- `KB_CONTENT_HOST_PATH` y `KB_CONFIG_HOST_PATH` están configurados
- El directorio existe y tiene contenido
- El container se creó después de configurar el KB

### Sync falla con "no_remote"

El workspace no se inicializó con el KB. Opciones:
- Recrear el workspace (eliminar volumen)
- Añadir el remote manualmente: `git remote add kb /kb-content`

### Conflictos persistentes

Si el usuario quiere descartar sus cambios y aceptar el KB:
```bash
git checkout --theirs <archivo>
git add <archivo>
git commit -m "Accept KB version"
```
