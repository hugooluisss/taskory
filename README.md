# Taskory

## Despliegue

Copia `.env.example` a `.env`, genera `JWT_SECRET` con `openssl rand -hex 32` y configura `PUBLIC_URL` con el origen público HTTPS. En producción, coloca tu terminador TLS delante de la web. Para probar localmente, usa `PUBLIC_URL=https://localhost:18080` y consulta nginx por `http://localhost:18080`. Arranca con `docker compose up -d --build`; la web se publica en el puerto `WEB_PORT` (8080 por defecto).

`WEB_BIND` vale `127.0.0.1` por defecto: configura el proxy TLS del host para conectarse a `127.0.0.1:WEB_PORT` y expón solo ese proxy. No publiques directamente el puerto web. El proxy TLS debe sobrescribir los `X-Forwarded-*` recibidos del cliente (o construirlos con sus propios valores), nunca anexar a ciegas valores suministrados por el cliente. nginx conserva `$proxy_add_x_forwarded_for` para añadir su conexión a la cadena. `TRUST_PROXY_HOPS` cuenta todos los proxies confiables, incluido nginx: 1 sin proxy externo, 2 con un proxy TLS delante.

Antes de cada actualización, respalda SQLite. El siguiente comando detiene la API para producir una copia consistente y luego la vuelve a iniciar:

```sh
docker compose stop api
docker run --rm -v taskory-data:/data -v "$PWD:/backup" alpine tar czf /backup/taskory-data.tar.gz -C /data .
docker compose start api
```

Para restaurar, detén el stack, extrae el archivo como root conservando propietarios (el usuario `node` de la API tiene UID 1000), vuelve a iniciar y comprueba la salud:

```sh
docker compose stop
docker run --rm -v taskory-data:/data -v "$PWD:/backup" alpine sh -c 'cd /data && tar xzpf /backup/taskory-data.tar.gz'
docker compose start
curl --fail http://127.0.0.1:${WEB_PORT:-8080}/api/v1/health
```

`docker compose down -v` elimina también el volumen de datos. La migración inicial está pensada para una base nueva; no convierte bases creadas previamente con TypeORM `synchronize`. Revertir (`down`) la migración inicial elimina todas las tablas.

Conecta un agente por MCP en `<PUBLIC_URL>/mcp`. Para habilitar Ollama, usa `docker compose --profile ollama up -d --build`; mantén `OLLAMA_BASE_URL=http://ollama:11434`.
En el primer arranque del perfil Ollama, el servicio de descarga obtiene el modelo configurado (`DEFAULT_LLM_MODEL`, por defecto `llama3.2`); la descarga puede tardar.
