## Context

Repo vacío. El contrato HTTP completo vive en `docs/api-contract.md` (fuente de verdad de rutas y payloads). Servicio para un solo despliegue personal pero multiusuario.

## Goals / Non-Goals

**Goals:** identidad, aislamiento por usuario, claves para el MCP, errores consistentes y localizados.
**Non-goals:** roles, OAuth, recuperación de contraseña.

## Decisions

- **NestJS + TypeORM + SQLite** (`DATABASE_PATH`): suficiente para un servidor personal; migrable a Postgres cambiando el driver.
- **Un solo guard** que acepta JWT o API key (`tk_` prefijo) y deja `request.user`. Evita duplicar autenticación en cada módulo.
- **Hash de contraseñas con argon2 o bcrypt**; API keys con SHA-256 (alta entropía, búsqueda por hash).
- **Errores**: filtro global que mapea excepciones a `{statusCode, code, message}` y traduce con un diccionario es/en por `code`.
- **Aislamiento**: toda consulta filtra por `userId`; recurso ajeno responde 404.
- **Dependencia nativa**: si el driver SQLite necesita compilar (`node-gyp`) y falla, usar una alternativa con binarios precompilados (p. ej. `better-sqlite3` con prebuilds o `node:sqlite`).

## Arquitectura controller -> service -> repository

- `AuthController`, `ApiKeysController`, `HealthController`: validan el DTO, llaman a un único service y devuelven la respuesta.
- `AuthService`, `ApiKeysService`: reglas de negocio (unicidad de email, comparación de hash, generación de clave, `lastUsedAt`).
- `UsersRepository`, `ApiKeysRepository`: único acceso a TypeORM. Los services nunca usan `EntityManager` directamente.
- El guard resuelve identidad a través de los services, no del repository.

## Risks / Trade-offs

- SQLite limita concurrencia de escritura → aceptable para uso personal.
- JWT sin revocación → expiración corta configurable.

## Open Questions

Ninguna.
