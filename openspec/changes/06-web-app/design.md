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
