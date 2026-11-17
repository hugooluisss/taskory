## 1. Base

- [x] 1.1 Crear `apps/web` (Angular estable, standalone, proxy dev a `localhost:3000`, config runtime `assets/config.json`) (spec: Runtime API configuration)
- [x] 1.2 Transloco con `es.json` y `en.json` y selector de idioma (spec: Internationalization)

## 2. Repositories

- [x] 2.1 `AuthRepository`, `ActivitiesRepository`, `ReportsRepository`, `ApiKeysRepository` tipados contra `docs/api-contract.md`
- [x] 2.2 Interceptor de Bearer y 401 con test (spec: Access)

## 3. Services

- [x] 3.1 `AuthService` (sesión, idioma del usuario) (spec: Access, Internationalization)
- [x] 3.2 `ActivitiesService` (normalizar tags y URLs, filtros) y `ReportsService`, `ApiKeysService`
- [x] 3.3 Mapeo de códigos de error de la API a claves de traducción

## 4. Controllers (páginas)

- [x] 4.1 Login y registro (spec: Access)
- [x] 4.2 Actividades: lista, filtros, paginación, formulario, confirmación de borrado, errores (spec: Activity management)
- [x] 4.3 Informes con Markdown sanitizado y copiar (spec: Report generation)
- [x] 4.3b Informes largos: progreso, sondeo, reintento, borrado y reanudación al recargar (spec: Long report progress; depende de 03b-chunked-reports)
- [x] 4.4 Ajustes: perfil y API keys en sección avanzada con confirmación al revocar (spec: Settings)
- [x] 4.5 Página `/oauth/consent` con login intermedio, permitir y denegar (spec: Agent connection and consent)
- [x] 4.6 Sección "Conecta tu agente" (URL del MCP, pasos simples) y lista de aplicaciones conectadas con desconexión confirmada (spec: Agent connection and consent, Connected apps)
- [x] 4.7 `OAuthRepository` y `ConnectedAppsRepository` + services con tests

## 5. Pruebas

- [x] 5.1 Tests de services, repositories, interceptor y de cada controller clave
- [x] 5.2 Build de producción sin errores

## 6. Revisión (trazabilidad)

- [x] 6.1 Revisión de diff por el arquitecto (ningún componente usa `HttpClient`)
- [x] 6.2 Revisión cruzada por un agente Codex distinto al autor contra el contrato
- [ ] 6.3 Verificación en navegador (agente a definir por el usuario)
