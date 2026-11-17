## 1. Imágenes

- [ ] 1.1 Dockerfile de `apps/api` multi-etapa, usuario no root (spec: Least privilege images)
- [ ] 1.2 Dockerfile de `apps/mcp`
- [ ] 1.3 Dockerfile de `apps/web` con nginx y proxy de `/api/v1`, `/oauth/*`, `/.well-known/*` a la api y `/mcp` al mcp (spec: Service wiring, Public URL and OAuth routing)

## 2. Compose

- [ ] 2.1 `docker-compose.yml` con volumen de datos y red interna (spec: Data persistence)
- [ ] 2.2 Perfil `ollama` opcional (spec: Optional Ollama)
- [ ] 2.3 `.env.example` y fallo claro sin `JWT_SECRET` ni `PUBLIC_URL` (spec: Secret handling, Public URL and OAuth routing)

## 3. Verificación

- [ ] 3.1 `docker compose up -d --build` y comprobación de `GET /api/v1/health` (spec: One-command startup)
- [ ] 3.2 Reinicio de contenedores conserva datos
- [ ] 3.3 Flujo extremo a extremo: registro, conexión del agente solo con la URL por OAuth, `log_activity` por MCP, aparece en la web

## 4. Revisión (trazabilidad)

- [ ] 4.1 Revisión por el arquitecto
- [ ] 4.2 Revisión cruzada por un agente Codex distinto al autor
