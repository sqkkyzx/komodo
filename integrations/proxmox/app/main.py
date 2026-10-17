"""Serve the PVE desktop with an optional, independently hosted extension.

Only the HTML entry point passes through this service. Existing Nginx routes
continue to send PVE APIs, uploads, assets, and WebSockets directly to PVE.
"""

from dataclasses import dataclass, field
import hashlib
import logging
import os
from pathlib import Path
import re
import ssl
from urllib.parse import parse_qs, urlsplit

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse, Response
import httpx

from app.komodo import KomodoClient
from app.pve_auth import PveAuthenticator


LOGGER = logging.getLogger("pve_komodo")
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
EXTENSION_PATH = "/pve-komodo/assets/extension.js"
VERSION = "0.2.0"

# Reject unknown desktop shapes instead of injecting into login providers,
# consoles, mobile UIs, or an HTML error page.
MANAGER_SCRIPT = re.compile(
    rb"<script\b[^>]*\bsrc=[\"']/pve2/js/pvemanagerlib\.js\?ver=(9\.[^\"']*)[\"'][^>]*>\s*</script>",
    re.IGNORECASE,
)
WORKSPACE_SCRIPT = re.compile(
    rb"<script\b[^>]*>\s*(?:if\s*\(typeof\(PVE\).*?;\s*)?"
    rb"Ext\.History\.fieldid\s*=.*?Ext\.onReady\(function\(\)\s*\{\s*"
    rb"Ext\.create\('PVE\.StdWorkspace'\);\s*\}\);\s*</script>",
    re.DOTALL,
)


def env_bool(name: str, default: bool) -> bool:
    value = os.environ.get(name, str(default)).lower().strip()
    if value in {"true", "1", "yes"}:
        return True
    if value in {"false", "0", "no"}:
        return False
    raise ValueError(f"{name} must be true or false")


@dataclass(frozen=True)
class Settings:
    upstream: str
    extension_enabled: bool = True
    tls_verify: bool = True
    ca_file: str | None = None
    admin_users: tuple[str, ...] = ("root@pam",)
    komodo_url: str | None = None
    komodo_api_key: str | None = field(default=None, repr=False)
    komodo_api_secret: str | None = field(default=None, repr=False)
    komodo_tls_verify: bool = True

    def __post_init__(self) -> None:
        parsed = urlsplit(self.upstream)
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or parsed.username is not None
            or parsed.password is not None
            or parsed.path not in {"", "/"}
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError("PVE_UPSTREAM must be a fixed HTTPS origin, e.g. https://pve.example:8006")
        # Validate the port now, instead of turning every request into a 500.
        _ = parsed.port
        if self.ca_file and not self.tls_verify:
            raise ValueError("PVE_CA_FILE cannot be combined with PVE_TLS_VERIFY=false")

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            upstream=os.environ["PVE_UPSTREAM"].rstrip("/"),
            extension_enabled=env_bool("PVE_EXTENSION_ENABLED", True),
            tls_verify=env_bool("PVE_TLS_VERIFY", True),
            ca_file=os.environ.get("PVE_CA_FILE") or None,
            admin_users=tuple(user.strip() for user in os.environ.get("PVE_ADMIN_USERS", "root@pam").split(",") if user.strip()),
            komodo_url=os.environ.get("KOMODO_URL") or None,
            komodo_api_key=os.environ.get("KOMODO_API_KEY") or None,
            komodo_api_secret=os.environ.get("KOMODO_API_SECRET") or None,
            komodo_tls_verify=env_bool("KOMODO_TLS_VERIFY", True),
        )

    def tls_context(self) -> ssl.SSLContext | bool:
        if not self.tls_verify:
            return False
        return ssl.create_default_context(cafile=self.ca_file)


def inject_extension(body: bytes, query: str, enabled: bool, asset_version: str) -> tuple[bytes, str]:
    params = parse_qs(query, keep_blank_values=True)
    if not enabled or params.get("pve-komodo") == ["off"]:
        return body, "disabled"
    if any(key in params for key in ("console", "novnc", "xtermjs", "mobile")):
        return body, "console-or-mobile"
    if EXTENSION_PATH.encode() in body:
        return body, "already-present"
    managers = list(MANAGER_SCRIPT.finditer(body))
    workspaces = list(WORKSPACE_SCRIPT.finditer(body))
    if len(managers) != 1 or len(workspaces) != 1:
        return body, "unsupported-page"
    insertion = workspaces[0].start()
    if managers[0].end() > insertion:
        return body, "unsupported-page"
    script = f'<script src="{EXTENSION_PATH}?v={asset_version}"></script>\n'.encode()
    return body[:insertion] + script + body[insertion:], "enabled"


def create_app(
    settings: Settings | None = None,
    *,
    transport: httpx.AsyncBaseTransport | None = None,
    pve_auth_transport: httpx.AsyncBaseTransport | None = None,
    komodo_transport: httpx.AsyncBaseTransport | None = None,
) -> FastAPI:
    config = settings or Settings.from_env()
    tls = config.tls_context()
    asset_version = hashlib.sha256((STATIC_DIR / "extension.js").read_bytes()).hexdigest()[:16]
    application = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    authenticator = PveAuthenticator(
        config.upstream, verify=tls, allowed_users=config.admin_users, transport=pve_auth_transport,
    )
    komodo = KomodoClient(
        config.komodo_url, config.komodo_api_key, config.komodo_api_secret,
        verify=config.komodo_tls_verify, transport=komodo_transport,
    )

    @application.middleware("http")
    async def private_api_responses(request: Request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/pve-komodo/api/"):
            response.headers["Cache-Control"] = "private, no-store"
            response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @application.get("/pve-komodo/api/session")
    async def session(request: Request) -> dict:
        user = await authenticator.authenticate(request)
        return {"user": user, "komodo_configured": komodo.configured}

    @application.get("/pve-komodo/api/connection")
    async def connection(request: Request) -> dict:
        # Authorize the browser session before using the service account. These
        # routes are read-only; future write routes also need CSRF protection.
        user = await authenticator.authenticate(request)
        status = await komodo.connection_status()
        LOGGER.info("Komodo connection check user=%s connected=%s", user, status["connected"])
        return {"user": user, "komodo": status}

    @application.get("/pve-komodo/health")
    async def health() -> JSONResponse:
        # This is service liveness, not a claim that PVE is reachable.
        return JSONResponse({"status": "ok", "version": VERSION, "extension_enabled": config.extension_enabled})

    @application.api_route(EXTENSION_PATH, methods=["GET", "HEAD"])
    async def extension() -> FileResponse:
        return FileResponse(
            STATIC_DIR / "extension.js",
            media_type="text/javascript; charset=utf-8",
            headers={"Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff"},
        )

    @application.api_route("/", methods=["GET", "HEAD"])
    async def desktop(request: Request) -> Response:
        query = request.url.query
        upstream_url = config.upstream.rstrip("/") + "/" + ("?" + query if query else "")
        headers = {
            name: request.headers[name]
            for name in ("cookie", "user-agent", "accept-language", "accept")
            if name in request.headers
        }
        headers["accept-encoding"] = "identity"
        # Never share HTTPX's cookie jar between users. The desktop is fetched
        # infrequently; an isolated client also prevents upstream Set-Cookie
        # responses from being replayed into another user's request.
        try:
            async with httpx.AsyncClient(
                verify=tls,
                timeout=httpx.Timeout(20.0, connect=5.0),
                follow_redirects=False,
                trust_env=False,
                transport=transport,
            ) as client:
                upstream = await client.get(upstream_url, headers=headers)
        except httpx.HTTPError:
            # Do not log URLs, cookies, or response bodies containing identity.
            LOGGER.warning("PVE desktop upstream request failed")
            return Response(
                "PVE upstream unavailable. Use the original PVE management address.",
                status_code=502,
                media_type="text/plain",
                headers={"Cache-Control": "no-store"},
            )

        body = upstream.content
        state = "upstream-response"
        if upstream.status_code == 200 and upstream.headers.get("content-type", "").split(";", 1)[0].strip().lower() == "text/html":
            body, state = inject_extension(body, query, config.extension_enabled, asset_version)

        # HTTPX has decoded Content-Encoding. Remove body validators as well as
        # hop-by-hop headers, and preserve duplicate Set-Cookie headers.
        excluded = {
            "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
            "te", "trailer", "transfer-encoding", "upgrade", "content-length",
            "content-encoding", "etag", "last-modified", "content-md5", "digest",
            "content-digest", "cache-control", "expires", "pragma",
        }
        excluded.update(part.strip().lower() for part in upstream.headers.get("connection", "").split(","))
        response = Response(content=b"" if request.method == "HEAD" else body, status_code=upstream.status_code)
        response.raw_headers = [
            (name, value) for name, value in upstream.headers.raw
            if name.decode("ascii").lower() not in excluded
        ]
        response.headers["Content-Length"] = str(len(body))
        response.headers["Cache-Control"] = "private, no-store"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        response.headers["X-PVE-KOMODO-Extension"] = state
        return response

    return application
