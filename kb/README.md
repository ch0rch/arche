# Knowledge Base (KB)

Este directorio contiene el Knowledge Base compartido que se inyecta en cada workspace de usuario.

## Contenido

| Directorio/Archivo | Descripción |
|--------------------|-------------|
| `Company/` | Identidad de marca, voz y tono, glosario, documentación de producto |
| `Templates/` | Plantillas operativas (PRD, KB entry, informes, etc.) |
| `System Prompts/` | Prompts de los agentes de OpenCode |
| `opencode.json` | Configuración de agentes |
| `AGENTS.md` | Instrucciones para agentes de código |

## Flujo de despliegue

1. **Deploy inicial**: El script `scripts/deploy-kb.sh` sincroniza este directorio en un repo Git bare en `/opt/arche/kb`.

2. **Creación de workspace**: Al crear un container para un usuario, se monta `/opt/arche/kb` como repo bare en `/kb` (read-write). El script de init clona el repo al workspace del usuario.

3. **Sincronización**: Los usuarios pueden actualizar su KB local ejecutando:
   ```bash
   git fetch kb
   git merge kb/main
   ```

## Actualización del KB

Para actualizar el KB en producción:

1. Edita los archivos en este directorio
2. Haz commit y push al repo principal
3. Ejecuta `scripts/deploy-kb.sh` en el VPS (o deja que CI/CD lo haga)
4. Los usuarios sincronizan manualmente o mediante el botón "Sync KB" en la UI
5. Para cambios desde workspaces, usa el botón "Publish KB" (push al repo central)

## Estructura esperada en el host

```
/opt/arche/
└── kb/                     # Repo Git bare (sin working tree)
    ├── HEAD
    ├── objects/
    ├── refs/
    └── config
```

## Notas

- El KB central es un repo bare y se actualiza con "Publish KB"
- Cada usuario tiene una **copia independiente** en su workspace
- Los cambios del usuario se empujan al repo central con git
- `deploy-kb.sh` sirve para seedear o sincronizar desde este repo
