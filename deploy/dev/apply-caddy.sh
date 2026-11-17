#!/bin/sh
set -eu

CADDYFILE=${CADDYFILE:-/etc/caddy/Caddyfile}
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
BACKUP="$CADDYFILE.bak.$(date +%s)"

cp -p "$CADDYFILE" "$BACKUP"
python3 - "$CADDYFILE" "$SCRIPT_DIR/Caddyfile.snippet" <<'PY'
from pathlib import Path
import sys

caddyfile = Path(sys.argv[1])
snippet = Path(sys.argv[2]).read_text().rstrip() + "\n"
text = caddyfile.read_text()
start = "\t# BEGIN taskory-dev\n"
end = "\t# END taskory-dev\n"
anchor = "\thandle {\n\t\troot * /var/www/agents-dev-landing"

if start in text and end in text:
    left, rest = text.split(start, 1)
    _, right = rest.split(end, 1)
    updated = left + "\t" + snippet.replace("\n", "\n\t").rstrip() + "\n" + right
else:
    if text.count(anchor) != 1:
        raise SystemExit("Expected exactly one agents-dev landing handle")
    updated = text.replace(anchor, "\t" + snippet.replace("\n", "\n\t").rstrip() + "\n\n" + anchor)

caddyfile.write_text(updated)
PY

if ! caddy validate --adapter caddyfile --config "$CADDYFILE"; then
	cp -p "$BACKUP" "$CADDYFILE"
	echo "Caddy validation failed; restored $BACKUP" >&2
	exit 1
fi

if [ "${RESTART:-1}" != "0" ]; then
	systemctl restart caddy
fi
printf 'Caddy config applied; backup: %s\n' "$BACKUP"
