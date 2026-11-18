# Taskory dev

Configura `.env.dev` con `DEV_HOST=agents-dev.hugosantiago.dev`, `PUBLIC_URL=https://agents-dev.hugosantiago.dev`, un `JWT_SECRET` aleatorio (mínimo 32 caracteres) y `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD`. El valor predeterminado de `DB_HOST` es `host.docker.internal`; Compose lo resuelve al host para que la API use MySQL 8.4. Opcional: `OLLAMA_BASE_URL`, `DEEPSEEK_API_KEY`, `DEFAULT_LLM_PROVIDER` y `DEFAULT_LLM_MODEL`. `TRUST_PROXY_HOPS` vale 2 por defecto: Caddy y el túnel de Cloudflare. MySQL aplica la política de contraseñas `MEDIUM`.

```sh
docker compose -f docker-compose.dev.yml --env-file .env.dev up -d --build --wait
```

En un panel de Herdr, aplica el fragmento al Caddy existente con `sudo deploy/dev/apply-caddy.sh`. El script crea una copia de respaldo, valida la configuración y la recarga solo si es válida.

Prueba el respaldo y la restauración solo con una base de prueba. Estos comandos usan exclusivamente `dev_taskory_test_ops`; no cambies ese nombre por `dev_taskory`:

```sh
set -a; . .env.dev; set +a
export MYSQL_PWD="$DB_PASSWORD"
docker run --rm --add-host host.docker.internal:host-gateway -e MYSQL_PWD mysql:8.4 mysql -h host.docker.internal -P "$DB_PORT" -u "$DB_USER" -e 'CREATE DATABASE dev_taskory_test_ops CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci'
docker run --rm --add-host host.docker.internal:host-gateway -e MYSQL_PWD mysql:8.4 mysqldump -h host.docker.internal -P "$DB_PORT" -u "$DB_USER" --no-tablespaces --single-transaction --databases dev_taskory_test_ops > backup.sql
docker run --rm -i --add-host host.docker.internal:host-gateway -e MYSQL_PWD mysql:8.4 mysql -h host.docker.internal -P "$DB_PORT" -u "$DB_USER" < backup.sql
docker run --rm --add-host host.docker.internal:host-gateway -e MYSQL_PWD mysql:8.4 mysql -h host.docker.internal -P "$DB_PORT" -u "$DB_USER" -e 'DROP DATABASE dev_taskory_test_ops'
```

La contraseña viaja como variable de entorno al contenedor temporal y no aparece en los argumentos del cliente. La copia SQLite antigua queda disponible en el volumen legacy `taskory-dev-data` mientras se prepara la migración.

La migración puntual desde una copia SQLite se ejecuta así contra la base vacía `dev_taskory_test_ops`, después de aplicar allí la migración base de MySQL:

```sh
set -a; . .env.dev; set +a
DB_HOST=127.0.0.1 DB_NAME=dev_taskory_test_ops node tools/migrate-sqlite-to-mysql.mjs /ruta/a/legacy.sqlite
```

El script exige una base MySQL vacía y compara los conteos por tabla al finalizar.

El túnel de Cloudflare conserva el hostname `agents-dev.hugosantiago.dev` y apunta al origen `http://localhost:8000`.

Conecta el agente a `https://agents-dev.hugosantiago.dev/taskory-mcp`. La web queda en `https://agents-dev.hugosantiago.dev/taskory-web/`. En dev, `MCP_PATH` vale `/taskory-mcp`; el valor predeterminado fuera de dev es `/mcp`. Para logs: `docker compose -f docker-compose.dev.yml --env-file .env.dev logs -f`. Para borrar también los datos locales: `docker compose -f docker-compose.dev.yml --env-file .env.dev down -v`.
