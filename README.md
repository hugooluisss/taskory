# Taskory

## Despliegue

Copia `.env.example` a `.env`, genera `JWT_SECRET` con `openssl rand -hex 32` y configura `PUBLIC_URL` con el origen público HTTPS. En producción, coloca tu terminador TLS delante de la web. Para probar localmente, usa `PUBLIC_URL=https://localhost:18080` y consulta nginx por `http://localhost:18080`. Arranca con `docker compose up -d --build`; la web se publica en el puerto `WEB_PORT` (8080 por defecto).

`WEB_BIND` vale `127.0.0.1` por defecto: configura el proxy TLS del host para conectarse a `127.0.0.1:WEB_PORT` y expón solo ese proxy. No publiques directamente el puerto web. El proxy TLS debe sobrescribir los `X-Forwarded-*` recibidos del cliente (o construirlos con sus propios valores), nunca anexar a ciegas valores suministrados por el cliente. nginx conserva `$proxy_add_x_forwarded_for` para añadir su conexión a la cadena. `TRUST_PROXY_HOPS` cuenta todos los proxies confiables, incluido nginx: 1 sin proxy externo, 2 con un proxy TLS delante.

## Enlaces para compartir informes

`WEB_PUBLIC_URL` es la URL base pública de la web, sin `/` final. Es obligatoria en producción y debe incluir la ruta base si la web se sirve bajo una subruta; por ejemplo: `https://host/taskory-web`. El Compose de producción la requiere en `.env`; `.env.example` trae el ejemplo. La API crea enlaces de informe válidos durante 30 días y permite renovarlos desde el detalle del informe; al renovar, el enlace anterior deja de funcionar. La página de informe muestra un QR después de crear o renovar el enlace y lo incluye al imprimir. La página pública del enlace muestra el período, idioma, nombres de proyectos y las actividades incluidas (fecha, título, descripción, proyectos, etiquetas y referencias); no muestra el informe generado ni información de la cuenta.

Configura `MYSQL_ROOT_PASSWORD`, `DB_NAME`, `DB_USER` y `DB_PASSWORD` en `.env`. MySQL aplica la política de contraseñas `MEDIUM`; usa contraseñas únicas que cumplan esa política. `DB_HOST=mysql` usa el servicio local del Compose; puedes definir `DB_HOST` con el hostname de un MySQL externo (en ese caso, el servicio local sigue disponible pero la API se conecta al host indicado).

Antes de cada actualización, respalda MySQL con una transacción consistente:

```sh
docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot --no-tablespaces --single-transaction --routines --triggers "$MYSQL_DATABASE"' > taskory.sql
```

Restaura el SQL en la base configurada:

```sh
docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot "$MYSQL_DATABASE"' < taskory.sql
```

Para volver a ese respaldo tras una actualización fallida, detén la API, restaura el archivo y vuelve a iniciarla. La restauración reemplaza las tablas del respaldo y descarta los cambios posteriores:

```sh
docker compose stop api
docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot "$MYSQL_DATABASE"' < taskory.sql
docker compose start api
```

Verifica los comandos de respaldo y restauración solo en una base de pruebas `dev_taskory_test*`; nunca ejecutes restauraciones sobre una base con datos que debas conservar. `docker compose down -v` elimina el volumen MySQL. La migración inicial está pensada para una base nueva; no convierte bases creadas previamente con TypeORM `synchronize`. Revertir (`down`) la migración inicial elimina todas las tablas.

Conecta un agente por MCP en `<PUBLIC_URL><MCP_PATH>` (`MCP_PATH` predeterminado: `/mcp`). Para habilitar Ollama, usa `docker compose --profile ollama up -d --build`; mantén `OLLAMA_BASE_URL=http://ollama:11434`.
En el primer arranque del perfil Ollama, el servicio de descarga obtiene el modelo configurado (`DEFAULT_LLM_MODEL`, por defecto `llama3.2`); la descarga puede tardar.

El proveedor y modelo (`DEFAULT_LLM_PROVIDER`, `DEFAULT_LLM_MODEL`) son configuración global del servidor y se usan para todos los informes.
Al configurar `DEFAULT_LLM_PROVIDER=deepseek`, el proveedor usa `deepseek-flash` de forma predeterminada; puedes cambiarlo globalmente con `DEFAULT_LLM_MODEL`.
`LLM_PRICE_INPUT_PER_MTOK` y `LLM_PRICE_OUTPUT_PER_MTOK` fijan los precios globales en USD por millón de tokens. Si se omiten, Ollama cuesta $0 y DeepSeek usa $0.30/$1.20 para entrada/salida. Es una estimación de costo máximo: no considera descuentos por caché ni por horario no pico.
