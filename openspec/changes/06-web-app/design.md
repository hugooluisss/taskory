## Context

Una primera versión de la app existe en una copia de respaldo (no está en el repo). Se reconstruye siguiendo esta fase; el respaldo sirve solo como referencia y sus fallos conocidos se corrigen: plantillas inline de una línea, borrado sin confirmar, informe en `<pre>`, mensajes de error sin traducir, copia del idioma en `localStorage` y `location.reload()`.

## Goals / Non-Goals

**Goals:** UI simple, responsive, bilingüe.
**Non-goals:** offline, tema oscuro, móvil nativo.

## Decisions

- Angular última versión estable, componentes standalone, signals, control flow nuevo.
- i18n en runtime con Transloco; todas las cadenas en `assets/i18n/{es,en}.json`.
- Markdown con `marked` y sanitización de Angular; nunca `bypassSecurityTrust*`.
- Plantillas en archivos `.html` separados.
- Token JWT en `localStorage`; interceptor añade `Authorization` y gestiona 401.

## Arquitectura controller -> service -> repository

- **Controller** = componente/página: solo estado de vista y eventos; sin `HttpClient` ni reglas de negocio.
- **Service** = `AuthService`, `ActivitiesService`, `ReportsService`, `ApiKeysService`: reglas independientes de la vista (normalizar tags/URLs, validar rangos, estado de sesión).
- **Repository** = `*Repository` tipados: único lugar con `HttpClient` hacia `/api/v1`.

## Risks / Trade-offs

- JWT en `localStorage` es vulnerable a XSS → mitigado con sanitización y CSP en el despliegue.

## Decisiones de ejecución (fase 06)

- **Guía visual y de accesibilidad**: `docs/web-design.md` (audiencia no técnica, quick-add, diálogos de confirmación accesibles con `<dialog>` en lugar de `window.confirm`, tokens CSS, componentes compartidos). Es obligatoria.
- **Proxy de desarrollo**: `proxy.conf.mjs` lee `API_PROXY_TARGET` (por defecto `http://localhost:3000`) y solo proxea `/api`; en esta máquina el puerto 3000 está ocupado por otro servicio, así que las pruebas usan `API_PROXY_TARGET=http://localhost:3999`.
- **Ruta de consentimiento**: `/oauth/consent?request=<id>` es una ruta de la web; en el despliegue (fase 07) esa ruta exacta va a la web y el resto de `/oauth/*` va a la API.
- **Pruebas**: Vitest con el ejecutor de Angular (`ng test`), TestBed, `HttpTestingController` solo en los repositories; las páginas se prueban con servicios falsos.
- **Estructura**: `src/app/core/` (repositories, interceptor, guards, config, i18n), `src/app/features/<feature>/` (página = controller con su `.html` y `.css`, service de la feature), `src/app/shared/` (componentes de UI).
