from urllib.parse import parse_qs, quote

from fastapi.testclient import TestClient
import httpx
import pytest

from app.main import Settings, create_app


TICKET = "PVE:root@pam:1234ABCD::signature+value="
COOKIE = "PVEAuthCookie=" + quote(TICKET, safe="")


def client_for(*, pve=None, komodo=None, configured=True, allowed=("root@pam",)):
    def no_call(request):
        pytest.fail("An unauthorized or unconfigured request contacted an upstream")

    return TestClient(create_app(
        Settings(
            "https://pve.example:8006", admin_users=allowed,
            komodo_url="http://komodo.example:9120" if configured else None,
            komodo_api_key="test-key" if configured else None,
            komodo_api_secret="test-secret" if configured else None,
        ),
        transport=httpx.MockTransport(no_call),
        pve_auth_transport=httpx.MockTransport(pve or no_call),
        komodo_transport=httpx.MockTransport(komodo or no_call),
    ))


def pve_success(request):
    assert request.url.host == "pve.example"
    assert request.headers["cookie"] == COOKIE
    assert "x-api-key" not in request.headers and "x-api-secret" not in request.headers
    if request.method == "GET":
        assert request.url.path == "/api2/json/access/permissions"
        assert not request.url.query
        return httpx.Response(200, json={"data": {"/": {"Sys.Audit": 1}}})
    assert request.method == "POST"
    assert request.url.path == "/api2/json/access/ticket"
    assert parse_qs(request.content.decode()) == {
        "username": ["root@pam"], "password": [TICKET], "path": ["/"], "privs": ["Sys.Audit"],
    }
    return httpx.Response(200, json={"data": {"username": "root@pam"}})


@pytest.mark.parametrize("route", ["session", "connection"])
def test_anonymous_request_is_denied_before_either_upstream(route):
    response = client_for().get("/pve-komodo/api/" + route)
    assert response.status_code == 401
    assert response.headers["cache-control"] == "private, no-store"
    assert "test-secret" not in response.text


def test_unlisted_user_denied_without_using_service_credentials():
    response = client_for(allowed=()).get("/pve-komodo/api/connection", headers={"cookie": COOKIE})
    assert response.status_code == 403
    assert "no-store" in response.headers["cache-control"]


@pytest.mark.parametrize("code,expected", [(401, 401), (403, 403), (500, 503), (302, 503)])
def test_failed_pve_verification_never_calls_komodo(code, expected):
    response = client_for(pve=lambda request: httpx.Response(code, text="sensitive-upstream-body")).get(
        "/pve-komodo/api/connection", headers={"cookie": COOKIE},
    )
    assert response.status_code == expected
    assert "sensitive-upstream-body" not in response.text
    assert "no-store" in response.headers["cache-control"]


def test_session_returns_verified_identity_without_connecting_komodo():
    response = client_for(pve=pve_success).get("/pve-komodo/api/session", headers={"cookie": COOKIE})
    assert response.status_code == 200
    assert response.json() == {"user": "root@pam", "komodo_configured": True}


def test_unconfigured_status_is_available_only_after_pve_verification():
    response = client_for(pve=pve_success, configured=False).get(
        "/pve-komodo/api/connection", headers={"cookie": COOKIE},
    )
    assert response.json() == {
        "user": "root@pam", "komodo": {"configured": False, "connected": False},
    }


def test_successful_connection_keeps_credentials_and_sessions_on_their_own_origins(caplog):
    def komodo(request):
        assert request.url.host == "komodo.example"
        assert "cookie" not in request.headers
        assert "authorization" not in request.headers
        if request.url.path == "/user":
            assert request.headers["x-api-key"] == "test-key"
            assert request.headers["x-api-secret"] == "test-secret"
            return httpx.Response(200, json={
                "username": "pve-integration", "enabled": True, "config": {"private": "hidden"},
            }, headers={"set-cookie": "should-not-be-forwarded=private"})
        assert request.url.path == "/version"
        assert "x-api-key" not in request.headers and "x-api-secret" not in request.headers
        return httpx.Response(200, text="2.3.3")

    response = client_for(pve=pve_success, komodo=komodo).get(
        "/pve-komodo/api/connection", headers={"cookie": COOKIE},
    )
    assert response.status_code == 200
    assert response.json() == {"user": "root@pam", "komodo": {
        "configured": True, "connected": True, "username": "pve-integration", "version": "2.3.3",
    }}
    for private in ("test-key", "test-secret", "signature+value", "hidden", "komodo.example"):
        assert private not in response.text
        assert private not in caplog.text
    assert "set-cookie" not in response.headers
    assert "no-store" in response.headers["cache-control"]


def test_invalid_komodo_credentials_return_safe_status_after_pve_verification():
    response = client_for(
        pve=pve_success, komodo=lambda request: httpx.Response(401, text="test-secret"),
    ).get("/pve-komodo/api/connection", headers={"cookie": COOKIE})
    assert response.status_code == 200
    assert response.json()["komodo"] == {
        "configured": True, "connected": False, "error_code": "invalid_credentials",
    }
    assert "test-secret" not in response.text


@pytest.mark.parametrize("route", ["session", "connection"])
def test_no_write_endpoints(route):
    response = client_for().post("/pve-komodo/api/" + route)
    assert response.status_code == 405
    assert "no-store" in response.headers["cache-control"]


def test_settings_load_new_environment_without_showing_credentials(monkeypatch):
    for name, value in {
        "PVE_UPSTREAM": "https://pve.example:8006", "PVE_ADMIN_USERS": "root@pam, alice@pve",
        "KOMODO_URL": "http://core:9120", "KOMODO_API_KEY": "test-key",
        "KOMODO_API_SECRET": "test-secret", "KOMODO_TLS_VERIFY": "false",
    }.items():
        monkeypatch.setenv(name, value)
    settings = Settings.from_env()
    assert settings.admin_users == ("root@pam", "alice@pve")
    assert settings.komodo_url == "http://core:9120"
    assert settings.komodo_api_key == "test-key"
    assert settings.komodo_api_secret == "test-secret"
    assert settings.komodo_tls_verify is False
    assert "test-key" not in repr(settings) and "test-secret" not in repr(settings)
    monkeypatch.setenv("PVE_ADMIN_USERS", "")
    assert Settings.from_env().admin_users == ()
