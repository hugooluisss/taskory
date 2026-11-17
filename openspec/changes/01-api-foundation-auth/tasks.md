## 1. Scaffold

- [ ] 1.1 Crear `apps/api` (NestJS, TypeScript, prefijo `/api/v1`, config por variables de entorno `JWT_SECRET`, `DATABASE_PATH`)
- [ ] 1.2 Configurar TypeORM + SQLite y entidades `User`, `ApiKey`
- [ ] 1.3 Endpoint `GET /health` (spec: user-auth / Health check)

## 2. Repositories

- [ ] 2.1 `UsersRepository` y `ApiKeysRepository` (único acceso a datos) con tests

## 3. Services

- [ ] 3.1 `AuthService`: registro con hash de contraseña, login, perfil (spec: User registration, Password security, User login, Authenticated profile)
- [ ] 3.2 `ApiKeysService`: crear, listar y revocar claves hasheadas (spec: API key creation, storage, revocation)
- [ ] 3.3 Guard único JWT o API key con `lastUsedAt` (spec: API key authentication)

## 4. Controllers

- [ ] 4.1 `AuthController` (`register`, `login`, `me`), `ApiKeysController`, `HealthController` sin reglas de negocio ni acceso a datos
- [ ] 4.2 Throttling en `/auth/*` (spec: Authentication rate limiting)

## 4b. Errores e i18n

- [ ] 4b.1 Filtro global de errores y diccionario es/en (spec: api-errors-i18n)
- [ ] 4b.2 Envelope de paginación reutilizable

## 5. Bruno

- [ ] 5.1 Colección `bruno/taskory` con `bruno.json`, entornos `local` y `server` y un `.bru` por endpoint de esta fase (health, auth, api-keys) con variables `baseUrl` y `token`

## 6. Pruebas

- [ ] 6.1 Tests unitarios y e2e de cada escenario del spec, incluido el aislamiento entre usuarios

## 7. Revisión (trazabilidad)

- [ ] 7.1 Revisión de diff por el arquitecto (duplicación, antipatrones, N+1, correctitud)
- [ ] 7.2 Revisión cruzada de cada endpoint y su `.bru` contra el spec por un agente Codex distinto al autor; hallazgos registrados y resueltos
