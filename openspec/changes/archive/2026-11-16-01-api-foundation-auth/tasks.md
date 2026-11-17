## 1. Scaffold

- [x] 1.1 Crear `apps/api` (NestJS, TypeScript, prefijo `/api/v1`, config por variables de entorno `JWT_SECRET`, `DATABASE_PATH`)
- [x] 1.2 Configurar TypeORM + SQLite y entidades `User`, `ApiKey`
- [x] 1.3 Endpoint `GET /health` (spec: user-auth / Health check)

## 2. Repositories

- [x] 2.1 `UsersRepository` y `ApiKeysRepository` (único acceso a datos) con tests

## 3. Services

- [x] 3.1 `AuthService`: registro con hash de contraseña, login, perfil (spec: User registration, Password security, User login, Authenticated profile)
- [x] 3.2 `ApiKeysService`: crear, listar y revocar claves hasheadas (spec: API key creation, storage, revocation)
- [x] 3.3 Guard único JWT o API key con `lastUsedAt` (spec: API key authentication)

## 4. Controllers

- [x] 4.1 `AuthController` (`register`, `login`, `me`), `ApiKeysController`, `HealthController` sin reglas de negocio ni acceso a datos
- [x] 4.2 Throttling en `/auth/*` (spec: Authentication rate limiting)

## 4b. Errores e i18n

- [x] 4b.1 Filtro global de errores y diccionario es/en (spec: api-errors-i18n)
- [x] 4b.2 Envelope de paginación reutilizable

## 4c. Correcciones de la revisión de diseño

- [x] 4c.1 El repository traduce el error de clave única a un error propio y el service solo conoce ese error
- [x] 4c.2 Límite de 20 API keys activas por usuario (spec: API key limit)
- [x] 4c.3 La autenticación solo captura fallos de verificación del token; los fallos de almacenamiento llegan al filtro global
- [x] 4c.4 `UsersService` contiene reglas reales (normalización de email, detección de duplicado) o se elimina el pass-through
- [x] 4c.5 Tests de repository sobre SQLite temporal (hash de key, revocación acotada al dueño, email)
- [x] 4c.6 e2e sobre el `AppModule` real y la configuración HTTP compartida con `main.ts`
- [x] 4c.7 Tests nombrados según requisito y escenario del spec; cobertura generada en `apps/api/coverage` (no en `src`)

- [x] 4c.8 Límite de 100 caracteres en `name` de usuario y de API key (spec: Input length limits)
- [x] 4c.9 Bruno: caso de clave ajena con dos usuarios reales, request con API key válida, request con `Accept-Language: fr`; documentar en los `.bru` los escenarios no expresables por HTTP (hash en base de datos, rate limit)

## 5. Bruno

- [x] 5.1 Colección `bruno/taskory` con `bruno.json`, entornos `local` y `server` y un `.bru` por endpoint de esta fase (health, auth, api-keys) con variables `baseUrl` y `token`

## 6. Pruebas

- [x] 6.1 Tests unitarios y e2e de cada escenario del spec, incluido el aislamiento entre usuarios

## 7. Revisión (trazabilidad)

- [x] 7.1 Revisión de diff por el arquitecto (duplicación, antipatrones, N+1, correctitud)
- [x] 7.2 Revisión cruzada de cada endpoint y su `.bru` contra el spec por un agente Codex distinto al autor; hallazgos registrados y resueltos
