# Taskory dev

Configura `.env.dev` con `DEV_HOST=agents-dev.hugosantiago.dev`, `PUBLIC_URL=https://agents-dev.hugosantiago.dev` y un `JWT_SECRET` aleatorio (mínimo 32 caracteres). Opcional: `OLLAMA_BASE_URL`, `DEEPSEEK_API_KEY`, `DEFAULT_LLM_PROVIDER` y `DEFAULT_LLM_MODEL`. `TRUST_PROXY_HOPS` vale 2 por defecto: Caddy y el túnel de Cloudflare.

```sh
docker compose -f docker-compose.dev.yml --env-file .env.dev up -d --build --wait
```

En un panel de Herdr, aplica el fragmento al Caddy existente con `sudo deploy/dev/apply-caddy.sh`. El script crea una copia de respaldo, valida la configuración y la recarga solo si es válida.

El túnel de Cloudflare conserva el hostname `agents-dev.hugosantiago.dev` y apunta al origen `http://localhost:8000`.

Conecta el agente a `https://agents-dev.hugosantiago.dev/taskory-mcp`. La web queda en `https://agents-dev.hugosantiago.dev/taskory-web/`. En dev, `MCP_PATH` vale `/taskory-mcp`; el valor predeterminado fuera de dev es `/mcp`. Para logs: `docker compose -f docker-compose.dev.yml --env-file .env.dev logs -f`. Para borrar también los datos locales: `docker compose -f docker-compose.dev.yml --env-file .env.dev down -v`.
