# Diseño: Credenciales por usuario/proveedor para OpenCode (gateway interno)

## Contexto y objetivos

- Permitir que cada usuario use modelos de OpenAI, Anthropic y OpenRouter en su workspace OpenCode.
- Mantener credenciales reales fuera del contenedor (solo en el VPS), con rotación y refresh sin reiniciar.
- Soportar autenticación por API key por usuario y proveedor, gestionada por admin.
- Alinear el alcance con el issue #56 (veredicto oficial) y dejar UI en el issue #55.

## Alcance

- Proveedores: OpenAI, Anthropic y OpenRouter.
- Credenciales por usuario y proveedor.
- Gestión por admin: alta, baja, rotación y revocación.
- Inyección de credenciales al runtime de OpenCode sin reiniciar contenedor.

Fuera de alcance:
- UI de credenciales (issue #55).
- Facturación o cuotas por usuario.

## Decisiones clave

- Gateway interno para proveedores (recomendado): OpenCode apunta a un endpoint interno compatible, y el contenedor solo guarda un token interno efímero.
- No se soporta login de suscripción (ChatGPT/Codex) en esta fase.

## Arquitectura

### Componentes

- **Arche BFF**: API de admin y usuario, cifra y guarda credenciales en DB, emite tokens internos efímeros.
- **Gateway de proveedores**: valida token interno, recupera credenciales reales y llama a OpenAI/Anthropic/OpenRouter.
- **Contenedor OpenCode**: usa `baseURL` hacia el gateway y un token interno como “apiKey”.
- **DB/Secret store**: guarda credenciales cifradas con `ARCHE_ENCRYPTION_KEY` (o KMS si existe).

### Red

- El gateway solo es accesible desde la red interna de contenedores.
- No hay acceso público directo al gateway.

## Configuración de OpenCode

- `provider.<id>.options.baseURL` apunta al gateway interno.
- La credencial que ve OpenCode es un token interno efímero, inyectado con `PUT /auth/{id}`.
- `enabled_providers` limita a `openai`, `anthropic` y `openrouter`.

Ejemplo conceptual (no literal):

```json
{
  "enabled_providers": ["openai", "anthropic", "openrouter"],
  "provider": {
    "openai": { "options": { "baseURL": "http://gateway:8080/openai" } },
    "anthropic": { "options": { "baseURL": "http://gateway:8080/anthropic" } },
    "openrouter": { "options": { "baseURL": "http://gateway:8080/openrouter" } }
  }
}
```

La credencial se entrega vía `/auth/{id}` con `{"type":"api","key":"<token-interno>"}`.

## Flujos

### API key (admin)

1. Admin crea/rota la API key por usuario/proveedor en el BFF.
2. El BFF cifra y guarda la clave en DB.
3. Al crear/arrancar workspace, el BFF genera token interno y lo inyecta en OpenCode (`PUT /auth/{id}`).
4. OpenCode llama al gateway con el token interno; el gateway usa la API key real.
5. Rotación/revocación: solo cambia DB; el gateway aplica inmediatamente (sin reinicio).

### Renovación de tokens internos

- Token interno con TTL corto (p. ej. 5-15 min), scope por `userId/workspaceId/provider`.
- Renovación vía `PUT /auth/{id}` sin reiniciar contenedor.
- Revocación inmediata al invalidar credenciales o cerrar cuenta.

## Modelo de datos (propuesto)

- `ProviderCredential`:
  - `userId`, `providerId`, `type` (`api`), `status` (enabled/disabled), `version`, `secret`, `lastError`, `lastUsedAt`, `createdAt`, `updatedAt`.
- `ProviderSecret` (cifrado):
  - `apiKey`.
- `ProviderAuditEvent`:
  - `actorId`, `action`, `providerId`, `userId`, `metadata`, `createdAt`.

## Seguridad

- Ninguna credencial real vive en el contenedor; solo token interno efímero.
- Token interno con expiración corta y revocable.
- Cifrado en reposo con clave de entorno; no se registran secretos en logs.
- Contenedores con mínimos permisos y sin acceso a secretos de otros usuarios.

## Errores y observabilidad

- Errores de auth se traducen a mensajes accionables.
- Métricas: 401/403 por proveedor, latencia, refresh fallidos, revocaciones.
- Logs con `userId`, `workspaceId`, `provider`, sin secretos.

## Veredicto de viabilidad (issue #56)

Autenticación soportada en esta fase:

- API key (vía oficial) por usuario y proveedor.

### Veredicto oficial

- Veredicto: la suscripción de ChatGPT no incluye uso de API; la autenticación oficial para API es por API key (Bearer).
- Fuente oficial: https://help.openai.com/en/articles/6950777-what-is-chatgpt-plus y https://platform.openai.com/docs/api-reference/authentication
- Fecha: 2026-02-05
- Implicación para el roadmap: mantener soporte por API key.

## Riesgos y mitigaciones

- **Compatibilidad de OpenCode con gateway**: si no acepta `baseURL`, se requiere adaptación (proxy transparente o patch).
- **Persistencia local de credenciales en OpenCode**: el token interno puede quedar en disco; mitigación con TTL corto y revocación.
- **Cambios de API de proveedores**: mantener el gateway como capa de adaptación.

## Plan de rollout

1. Discovery (bloqueante): validar viabilidad oficial del OAuth y compatibilidad técnica de `baseURL`.
2. MVP interno: API keys + gateway + token interno efímero.
4. GA: activar por defecto según política de producto.

## Preguntas abiertas

- Confirmar compatibilidad de OpenCode con `baseURL` para OpenAI/Anthropic/OpenRouter.
- Definir TTL y rotación de tokens internos.
- Decidir si el gateway vive dentro del BFF o como servicio dedicado.

## Referencias

- Issue #56: `https://github.com/peaberry-studio/arche/issues/56`
- UI de credenciales: issue #55 (fuera de alcance)
- OpenCode docs: `/docs/server`, `/docs/config`, `/docs/sdk` (Feb 5, 2026)
