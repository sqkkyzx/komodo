"""Read-only, server-side Komodo connectivity checks.

The caller must authenticate and authorize the PVE user before invoking this
client. Komodo API credentials never form part of the returned browser data.
"""

import re
import ssl
from urllib.parse import urlsplit

import httpx


VERSION = re.compile(r"[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?")


def _origin(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    try:
        parsed = urlsplit(value)
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.hostname
            or parsed.username is not None
            or parsed.password is not None
            or parsed.path not in {"", "/"}
            or parsed.query
            or parsed.fragment
            or "?" in value
            or "#" in value
            or "\\" in value
            or any(character.isspace() or ord(character) < 32 for character in value)
        ):
            raise ValueError
        _ = parsed.port
        return str(httpx.URL(value)).rstrip("/")
    except (ValueError, httpx.InvalidURL):
        # Do not include the supplied URL: it might contain credentials.
        raise ValueError("KOMODO_URL must be a fixed HTTP(S) origin") from None


def _credential(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    if any(ord(character) < 32 or ord(character) >= 127 for character in value):
        raise ValueError("Komodo API credentials must contain valid ASCII header characters")
    return value


class KomodoClient:
    def __init__(
        self,
        url: str | None,
        key: str | None,
        secret: str | None,
        *,
        verify: ssl.SSLContext | bool = True,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._origin = _origin(url)
        self._key = _credential(key)
        self._secret = _credential(secret)
        self._verify = verify
        self._transport = transport

    def __repr__(self) -> str:
        return f"KomodoClient(configured={self.configured})"

    @property
    def configured(self) -> bool:
        return bool(self._origin and self._key and self._secret)

    @staticmethod
    def _failure(code: str) -> dict:
        return {"configured": True, "connected": False, "error_code": code}

    async def connection_status(self) -> dict:
        if not self.configured:
            return {"configured": False, "connected": False}

        # Per-check clients isolate both PVE sessions and other callers. Ignore
        # environment proxies and never follow redirects carrying API keys.
        try:
            async with httpx.AsyncClient(
                verify=self._verify,
                transport=self._transport,
                trust_env=False,
                follow_redirects=False,
                timeout=httpx.Timeout(10.0, connect=5.0),
            ) as client:
                user_response = await client.get(
                    self._origin + "/user",
                    headers={"x-api-key": self._key, "x-api-secret": self._secret},
                )
                if user_response.status_code in {401, 403}:
                    return self._failure("invalid_credentials")
                if user_response.status_code != 200:
                    return self._failure("upstream_unavailable")
                try:
                    user = user_response.json()
                except ValueError:
                    return self._failure("invalid_response")
                if not isinstance(user, dict):
                    return self._failure("invalid_response")
                if user.get("enabled") is False:
                    return self._failure("invalid_credentials")
                username = user.get("username")
                if (
                    user.get("enabled") is not True
                    or not isinstance(username, str)
                    or not username.strip()
                    or len(username) > 256
                    or any(ord(character) < 32 or ord(character) == 127 for character in username)
                ):
                    return self._failure("invalid_response")

                # /version is public. Neither API credentials nor cookies from
                # the preceding response need to be sent to it.
                client.cookies.clear()
                version_response = await client.get(self._origin + "/version")
                if version_response.status_code != 200:
                    return self._failure("upstream_unavailable")
                version = version_response.text.strip()
                if len(version) > 128 or VERSION.fullmatch(version) is None:
                    return self._failure("invalid_response")
        except httpx.HTTPError:
            # Responses and exceptions can echo headers or embed sensitive URLs.
            return self._failure("upstream_unavailable")

        return {
            "configured": True,
            "connected": True,
            "username": username,
            "version": version,
        }
