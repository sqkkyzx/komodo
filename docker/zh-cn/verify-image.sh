#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $# -ne 2 ]]; then
  printf 'Usage: %s IMAGE_REF EXPECTED_VERSION\n' "$0" >&2
  exit 2
fi

image_ref=$1
expected_version=$2
mongo_image=${MONGO_IMAGE:-mongo:8.0.15@sha256:8332f93f6cb881db35f58caaea2e986e6044f97a3cf2629515875361b3ae359c}
tmp_dir=$(mktemp -d)
smoke_id="komodo-zh-smoke-$$-${RANDOM}"
network_name="${smoke_id}-network"
mongo_name="${smoke_id}-mongo"
core_name="${smoke_id}-core"
base_check_name="${smoke_id}-base-check"
image_check_name="${smoke_id}-image-check"

fail() {
  printf 'Image verification failed: %s\n' "$1" >&2
  exit 1
}

cleanup() {
  local exit_status=$?
  trap - EXIT
  set +e
  if (( exit_status != 0 )); then
    # State is useful for startup failures and contains no environment or logs.
    for container_name in "$mongo_name" "$core_name"; do
      docker container inspect --format \
        '{{.Name}}: status={{.State.Status}} exit={{.State.ExitCode}} oom={{.State.OOMKilled}}' \
        "$container_name" 2>/dev/null >&2
    done
  fi
  docker container rm --force --volumes \
    "$core_name" "$mongo_name" "$base_check_name" "$image_check_name" \
    >/dev/null 2>&1
  docker network rm "$network_name" >/dev/null 2>&1
  rm -rf "$tmp_dir"
  exit "$exit_status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

for command_name in docker curl python3; do
  command -v "$command_name" >/dev/null || fail "Required command is missing: $command_name"
done

platform=$(docker image inspect --format '{{.Os}}/{{.Architecture}}' "$image_ref")
[[ "$platform" == linux/amd64 ]] || fail "Final image platform must be linux/amd64."
base_image=$(docker image inspect --format \
  '{{index .Config.Labels "org.opencontainers.image.base.name"}}' "$image_ref")
[[ "$base_image" =~ ^ghcr\.io/moghtech/komodo-core(:[[:alnum:]_.-]+)?@sha256:[a-f0-9]{64}$ ]] \
  || fail "The base.name label must identify an official Komodo image pinned by digest."

printf 'Checking the pinned base and unchanged Core/CLI binaries...\n'
docker pull --platform linux/amd64 "$base_image" >/dev/null
docker run --rm --name "$base_check_name" --network none --platform linux/amd64 \
  --entrypoint sha256sum "$base_image" /usr/local/bin/core /usr/local/bin/km \
  >"$tmp_dir/base.sha256"
docker run --rm --name "$image_check_name" --network none --platform linux/amd64 \
  --entrypoint sha256sum "$image_ref" /usr/local/bin/core /usr/local/bin/km \
  >"$tmp_dir/image.sha256"
[[ "$(<"$tmp_dir/base.sha256")" == "$(<"$tmp_dir/image.sha256")" ]] \
  || fail "Core or CLI differs from the pinned official base."

printf 'Starting an isolated MongoDB and Core smoke test...\n'
docker pull --platform linux/amd64 "$mongo_image" >/dev/null
docker network create --driver bridge "$network_name" >/dev/null
docker run --detach --name "$mongo_name" --network "$network_name" \
  --platform linux/amd64 "$mongo_image" >/dev/null

# Share one 90-second startup budget between MongoDB and Core.
deadline=$((SECONDS + 90))
mongo_ready=false
while (( SECONDS < deadline )); do
  if docker exec "$mongo_name" mongosh --quiet \
    'mongodb://127.0.0.1:27017/?serverSelectionTimeoutMS=1000&connectTimeoutMS=1000' \
    --eval 'quit(db.adminCommand({ping: 1}).ok ? 0 : 1)' >/dev/null 2>&1; then
    mongo_ready=true
    break
  fi
  [[ "$(docker container inspect --format '{{.State.Running}}' "$mongo_name")" == true ]] \
    || fail "MongoDB exited before becoming ready."
  sleep 1
done
[[ "$mongo_ready" == true ]] || fail "MongoDB was not ready within the startup budget."

docker run --detach --name "$core_name" --network "$network_name" \
  --platform linux/amd64 --publish 127.0.0.1::9120 \
  --env "KOMODO_DATABASE_URI=mongodb://${mongo_name}:27017" \
  --env KOMODO_HOST=http://localhost:9120 \
  --env KOMODO_BIND_IP=0.0.0.0 \
  --env KOMODO_LOCAL_AUTH=true \
  --env KOMODO_DISABLE_INIT_RESOURCES=true \
  "$image_ref" >/dev/null

host_port=$(docker container inspect --format \
  '{{(index (index .NetworkSettings.Ports "9120/tcp") 0).HostPort}}' "$core_name")
[[ "$host_port" =~ ^[0-9]+$ ]] || fail "Core has no published loopback port."
origin="http://127.0.0.1:${host_port}"

fetch() {
  local url=$1
  local output_name=$2
  http_status=$(curl --silent --show-error --noproxy '*' \
    --connect-timeout 2 --max-time 3 \
    --dump-header "$tmp_dir/${output_name}.headers" \
    --output "$tmp_dir/${output_name}.body" \
    --write-out '%{http_code}' "$url" 2>"$tmp_dir/${output_name}.curl-error")
}

core_ready=false
while (( SECONDS < deadline )); do
  if fetch "$origin/version" version && [[ "$http_status" == 200 ]]; then
    python3 - "$tmp_dir/version.body" "$expected_version" <<'PY'
import pathlib
import sys

if pathlib.Path(sys.argv[1]).read_text().strip() != sys.argv[2]:
    raise SystemExit("The running Core version differs from the expected version.")
PY
    core_ready=true
    break
  fi
  [[ "$(docker container inspect --format '{{.State.Running}}' "$core_name")" == true ]] \
    || fail "Core exited before becoming ready."
  sleep 1
done
[[ "$core_ready" == true ]] || fail "Core was not ready within the shared 90-second startup budget."

fetch "$origin/" index || fail "The homepage request failed."
[[ "$http_status" == 200 ]] || fail "The homepage did not return HTTP 200."
python3 - "$tmp_dir" "$origin" <<'PY'
from html.parser import HTMLParser
from pathlib import Path
import re
import sys
from urllib.parse import urljoin, urlsplit

directory = Path(sys.argv[1])
origin = sys.argv[2]


def content_type(name):
    headers = (directory / f"{name}.headers").read_text()
    values = [line.partition(":")[2].strip().split(";", 1)[0].lower()
              for line in headers.splitlines()
              if line.lower().startswith("content-type:")]
    return values[-1] if values else ""


html = (directory / "index.body").read_text()
if content_type("index") != "text/html" or not re.search(r"<html(?:\s|>)", html, re.I):
    raise SystemExit("The homepage response is not an HTML document.")
if not re.search(r'<html\b[^>]*\blang=[\"\x27]zh-CN[\"\x27]', html, re.I):
    raise SystemExit("The homepage must declare the zh-CN locale.")


class Assets(HTMLParser):
    scripts = []
    styles = []

    def handle_starttag(self, tag, attributes):
        attributes = dict(attributes)
        if tag == "script" and attributes.get("src"):
            self.scripts.append(attributes["src"])
        if tag == "link" and "stylesheet" in attributes.get("rel", "").lower().split():
            if attributes.get("href"):
                self.styles.append(attributes["href"])


assets = Assets()
assets.feed(html)
urls = []
for candidates, extensions in [(assets.scripts, (".js", ".mjs")), (assets.styles, (".css",))]:
    for candidate in candidates:
        url = urljoin(origin + "/", candidate)
        parts = urlsplit(url)
        if (parts.scheme, parts.netloc) == (urlsplit(origin).scheme, urlsplit(origin).netloc) \
                and parts.path.lower().endswith(extensions):
            urls.append(url)
            break
    else:
        raise SystemExit("The homepage must reference local JavaScript and CSS assets.")
(directory / "asset-urls").write_text("\n".join(urls) + "\n")
PY

asset_names=(javascript stylesheet)
asset_index=0
while IFS= read -r asset_url; do
  asset_name=${asset_names[$asset_index]}
  fetch "$asset_url" "$asset_name" || fail "A referenced $asset_name request failed."
  [[ "$http_status" == 200 ]] || fail "A referenced $asset_name did not return HTTP 200."
  python3 - "$tmp_dir" "$asset_name" <<'PY'
from pathlib import Path
import re
import sys

directory = Path(sys.argv[1])
name = sys.argv[2]
headers = (directory / f"{name}.headers").read_text()
types = [line.partition(":")[2].strip().split(";", 1)[0].lower()
         for line in headers.splitlines() if line.lower().startswith("content-type:")]
allowed = ({"text/javascript", "application/javascript", "text/ecmascript", "application/ecmascript"}
           if name == "javascript" else {"text/css"})
body = (directory / f"{name}.body").read_bytes()
if not types or types[-1] not in allowed:
    raise SystemExit(f"The {name} response has an incorrect Content-Type; SPA fallback is not accepted.")
if not body.strip() or re.search(br"^\s*(?:<!doctype\s+html|<html[\s>])", body[:1024], re.I):
    raise SystemExit(f"The {name} response is empty or contains an HTML fallback.")
if name == "javascript":
    source = body.decode("utf-8")
    # Vite may emit literal Chinese text or JavaScript Unicode escapes.
    source = re.sub(
        r"(?<!\\)\\u(?:([0-9a-fA-F]{4})|\{([0-9a-fA-F]{1,6})\})",
        lambda match: chr(int(match[1] or match[2], 16)),
        source,
    )
    required = ["输入用户名", "用户名不能为空", "切换账号", "计划任务"]
    missing = [text for text in required if text not in source]
    if missing:
        raise SystemExit("The served JavaScript bundle is missing required zh-CN UI text: "
                         + ", ".join(missing))
PY
  asset_index=$((asset_index + 1))
done <"$tmp_dir/asset-urls"
[[ "$asset_index" == 2 ]] || fail "Both JavaScript and CSS assets must be checked."

printf 'Verified linux/amd64, unchanged Core/CLI, Core %s, homepage, referenced JS/CSS, and zh-CN UI text.\n' \
  "$expected_version"
