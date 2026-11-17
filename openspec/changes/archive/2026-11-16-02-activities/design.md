## Context

Fase 01 entrega usuario autenticado en `request.user`. Contrato en `docs/api-contract.md`.

## Goals / Non-Goals

**Goals:** modelo genérico de actividad, aislamiento estricto, filtros útiles para informes.
**Non-goals:** adjuntos, duraciones, estados.

## Decisions

- `referenceUrls` y `tags` se guardan como JSON en la fila de la actividad (simple; el filtro por tag se hace con consulta sobre JSON o tabla auxiliar si SQLite lo exige).
- Normalización de tags en el service, no en el controller.
- `/activities/meta` se declara antes de `/activities/:id`.
- Toda consulta del repository recibe `userId` obligatorio; no existe método sin él (evita fugas por omisión).

## Arquitectura controller -> service -> repository

- `ActivitiesController`: valida DTOs, extrae `userId` del request, llama a `ActivitiesService`.
- `ActivitiesService`: normaliza tags, aplica límites, traduce "no encontrado" a `NOT_FOUND`.
- `ActivitiesRepository`: queries con filtros y paginación, siempre filtradas por `userId`; una sola consulta por listado (sin N+1).

## Risks / Trade-offs

- Filtrar tags dentro de JSON puede no usar índice → aceptable para el volumen personal.
