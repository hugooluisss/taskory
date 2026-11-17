## Why

Taskory es multiusuario: cada persona guarda sus propias actividades y su agente (vía MCP) debe poder autenticarse como ella. Sin identidad, aislamiento de datos y claves personales, ninguna otra fase puede construirse.

## What Changes

- Scaffold de `apps/api` (NestJS + TypeScript + SQLite) con prefijo global `/api/v1`.
- Registro, login y perfil de usuario con JWT.
- API keys personales (`tk_...`) para clientes máquina como el MCP.
- Errores con código estable y mensaje localizado es/en.
- Endpoint de salud y límite de peticiones en `/auth/*`.
- Colección Bruno con los endpoints de esta fase.

## Capabilities

### New Capabilities
- `user-auth`: registro, login, perfil y resolución de identidad por JWT.
- `api-keys`: creación, listado y revocación de claves personales.
- `api-errors-i18n`: formato de error uniforme y localización es/en.

### Modified Capabilities
(ninguna)

## Impact

- Código nuevo en `apps/api` y `bruno/taskory`.
- Contrato de referencia: `docs/api-contract.md`.
- Las fases 02, 03 y 04 (OAuth) dependen de esta.

## Non-goals

- Recuperación de contraseña, verificación de email, OAuth, roles de administrador.
