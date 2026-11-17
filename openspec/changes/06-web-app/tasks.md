## 1. Base

- [ ] 1.1 Crear `apps/web` (Angular estable, standalone, proxy dev a `localhost:3000`, config runtime `assets/config.json`) (spec: Runtime API configuration)
- [ ] 1.2 Transloco con `es.json` y `en.json` y selector de idioma (spec: Internationalization)

## 2. Repositories

- [ ] 2.1 `AuthRepository`, `ActivitiesRepository`, `ReportsRepository`, `ApiKeysRepository` tipados contra `docs/api-contract.md`
- [ ] 2.2 Interceptor de Bearer y 401 con test (spec: Access)

## 3. Services

- [ ] 3.1 `AuthService` (sesión, idioma del usuario) (spec: Access, Internationalization)
- [ ] 3.2 `ActivitiesService` (normalizar tags y URLs, filtros) y `ReportsService`, `ApiKeysService`
- [ ] 3.3 Mapeo de códigos de error de la API a claves de traducción

## 4. Controllers (páginas)

- [ ] 4.1 Login y registro (spec: Access)
- [ ] 4.2 Actividades: lista, filtros, paginación, formulario, confirmación de borrado, errores (spec: Activity management)
- [ ] 4.3 Informes con Markdown sanitizado y copiar (spec: Report generation)
- [ ] 4.4 Ajustes: perfil y API keys en sección avanzada con confirmación al revocar (spec: Settings)
- [ ] 4.5 Página `/oauth/consent` con login intermedio, permitir y denegar (spec: Agent connection and consent)
- [ ] 4.6 Sección "Conecta tu agente" (URL del MCP, pasos simples) y lista de aplicaciones conectadas con desconexión confirmada (spec: Agent connection and consent, Connected apps)
- [ ] 4.7 `OAuthRepository` y `ConnectedAppsRepository` + services con tests

## 5. Pruebas

- [ ] 5.1 Tests de services, repositories, interceptor y de cada controller clave
- [ ] 5.2 Build de producción sin errores

## 6. Revisión (trazabilidad)

- [ ] 6.1 Revisión de diff por el arquitecto (ningún componente usa `HttpClient`)
- [ ] 6.2 Revisión cruzada por un agente Codex distinto al autor contra el contrato
- [ ] 6.3 Verificación en navegador (agente a definir por el usuario)
