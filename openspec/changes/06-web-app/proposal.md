## Why

Además del agente, el usuario necesita una interfaz gráfica para registrar y editar actividades manualmente, generar informes y gestionar sus API keys.

## What Changes

- Aplicación Angular (última versión estable) en `apps/web`.
- Registro/login, actividades, informes y ajustes (perfil, aplicaciones conectadas y API keys como opción avanzada).
- Pantalla de consentimiento OAuth y guía "Conecta tu agente" para usuarios no técnicos.
- Interfaz completa en español e inglés con cambio en caliente.

## Capabilities

### New Capabilities
- `web-client`: comportamiento de la interfaz web (acceso, actividades, informes, ajustes, idioma).

### Modified Capabilities
(ninguna)

## Impact

- Código en `apps/web`. Depende de las fases 01, 02, 03 y 04.
- La URL de la API se lee de configuración en runtime (`assets/config.json`).

## Non-goals

- App móvil, modo offline, edición colaborativa, tema oscuro.
