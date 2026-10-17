import gzip

from fastapi.testclient import TestClient
import httpx
import pytest

from app.main import EXTENSION_PATH, Settings, create_app


# The relevant structure of PVE's desktop template. All identity fields must
# survive injection unchanged; console templates deliberately lack this shape.
DESKTOP = b"""<!DOCTYPE html><html><head>
<script>Proxmox = {UserName: 'alice@pve', CSRFPreventionToken: 'csrf-value'};</script>
<script src="/proxmoxlib.js?ver=5.0.0"></script>
<script type="text/javascript" src="/pve2/js/pvemanagerlib.js?ver=9.2.22"></script>
<script src="/pve2/ext6/locale/locale-en.js?ver=7.0.0"></script>
<script type="text/javascript">
if (typeof(PVE) === 'undefined') PVE = {};
Ext.History.fieldid = 'x-history-field';
Ext.onReady(function() { Ext.create('PVE.StdWorkspace');});
</script></head><body></body></html>"""


def client_for(handler, *, enabled=True):
    return TestClient(create_app(
        Settings("https://pve.example:8006", extension_enabled=enabled),
        transport=httpx.MockTransport(handler),
    ))


def html_response(body=DESKTOP, **kwargs):
    return httpx.Response(200, content=body, headers={"content-type": "text/html; charset=utf-8", **kwargs})


def test_inject_after_dependencies_before_workspace_and_preserve_session():
    def upstream(request):
        assert str(request.url) == "https://pve.example:8006/?lang=zh_CN&theme=auto"
        assert request.headers["cookie"] == "PVEAuthCookie=alice-ticket; PVELangCookie=zh_CN"
        assert request.headers["accept-encoding"] == "identity"
        assert "if-none-match" not in request.headers
        return html_response()

    response = client_for(upstream).get(
        "/?lang=zh_CN&theme=auto",
        headers={"cookie": "PVEAuthCookie=alice-ticket; PVELangCookie=zh_CN", "if-none-match": "old"},
    )
    assert response.status_code == 200
    assert response.headers["x-pve-komodo-extension"] == "enabled"
    body = response.content
    assert body.index(b"pvemanagerlib.js") < body.index(EXTENSION_PATH.encode()) < body.index(b"Ext.onReady")
    assert body.count(EXTENSION_PATH.encode()) == 1
    assert b"UserName: 'alice@pve', CSRFPreventionToken: 'csrf-value'" in body
    assert int(response.headers["content-length"]) == len(body)
    assert response.headers["cache-control"] == "private, no-store"


@pytest.mark.parametrize("query", ["console=kvm&novnc=1", "console=shell&xtermjs=1", "mobile=1", "novnc=1"])
def test_console_and_mobile_are_passed_through(query):
    response = client_for(lambda request: html_response()).get("/?" + query)
    assert response.content == DESKTOP
    assert response.headers["x-pve-komodo-extension"] == "console-or-mobile"


@pytest.mark.parametrize("enabled,query", [(False, ""), (True, "?pve-komodo=off")])
def test_disable_and_browser_escape_hatch(enabled, query):
    response = client_for(lambda request: html_response(), enabled=enabled).get("/" + query)
    assert response.content == DESKTOP
    assert response.headers["x-pve-komodo-extension"] == "disabled"


@pytest.mark.parametrize("body", [
    b"<html><body>Upstream error</body></html>",
    DESKTOP.replace(b"ver=9.2.22", b"ver=8.4.0"),
    DESKTOP.replace(b"ver=9.2.22", b"ver=10.0.0"),
    DESKTOP.replace(b"PVE.StdWorkspace", b"PVE.NewWorkspace"),
    DESKTOP + DESKTOP,
])
def test_unknown_templates_are_unchanged(body):
    response = client_for(lambda request: html_response(body)).get("/")
    assert response.content == body
    assert response.headers["x-pve-komodo-extension"] == "unsupported-page"


def test_no_duplicate_injection():
    first = client_for(lambda request: html_response()).get("/").content
    response = client_for(lambda request: html_response(first)).get("/")
    assert response.content == first
    assert response.headers["x-pve-komodo-extension"] == "already-present"


def test_upstream_cookies_are_not_reused_for_other_visitors():
    seen = []

    def upstream(request):
        seen.append(request.headers.get("cookie"))
        return httpx.Response(200, content=DESKTOP, headers=[
            ("content-type", "text/html"),
            ("set-cookie", "PVEAuthCookie=upstream-ticket; Path=/; Secure"),
            ("set-cookie", "PVEThemeCookie=dark; Path=/; Secure"),
        ])

    client = client_for(upstream)
    response = client.get("/", headers={"cookie": "PVEAuthCookie=alice"})
    assert len(response.headers.get_list("set-cookie")) == 2
    client.cookies.clear()
    client.get("/")
    client.get("/", headers={"cookie": "PVEAuthCookie=bob"})
    assert seen == ["PVEAuthCookie=alice", None, "PVEAuthCookie=bob"]


def test_decode_upstream_compression_remove_stale_validators_and_hop_headers():
    response = client_for(lambda request: httpx.Response(200, content=gzip.compress(DESKTOP), headers={
        "content-type": "text/html", "content-encoding": "gzip", "etag": '"old"',
        "last-modified": "yesterday", "connection": "keep-alive, x-internal",
        "x-internal": "private", "x-frame-options": "SAMEORIGIN",
    })).get("/")
    assert EXTENSION_PATH in response.text
    for name in ("content-encoding", "etag", "last-modified", "connection", "x-internal"):
        assert name not in response.headers
    assert response.headers["x-frame-options"] == "SAMEORIGIN"
    assert len(response.content) == int(response.headers["content-length"])


def test_head_has_get_length_without_body():
    client = client_for(lambda request: html_response())
    get = client.get("/")
    head = client.head("/")
    assert head.status_code == 200
    assert head.content == b""
    assert head.headers["content-length"] == get.headers["content-length"]


def test_upstream_error_and_redirect_are_not_injected_or_followed():
    for status in (401, 403, 500, 302):
        response = client_for(lambda request: httpx.Response(
            status, content=DESKTOP, headers={"content-type": "text/html", "location": "/login"},
        )).get("/", follow_redirects=False)
        assert response.status_code == status
        assert response.content == DESKTOP
        assert response.headers["location"] == "/login"


def test_upstream_unavailable_does_not_expose_ticket(caplog):
    def upstream(request):
        raise httpx.ConnectError("secret-ticket", request=request)

    response = client_for(upstream).get("/?vncticket=secret-ticket")
    assert response.status_code == 502
    assert "secret-ticket" not in response.text
    assert "secret-ticket" not in caplog.text


def test_no_generic_api_or_open_proxy_and_health_does_not_contact_pve():
    def unexpected(request):
        pytest.fail("this route must not contact PVE")

    client = client_for(unexpected)
    assert client.get("/pve-komodo/health").json()["status"] == "ok"
    assert client.get(EXTENSION_PATH).status_code == 200
    assert "Docker 管理" in client.get(EXTENSION_PATH).text
    assert client.get("/api2/json/cluster/resources").status_code == 404
    assert client.post("/").status_code == 405
    assert client.get("/pve-komodo/assets/../app/main.py").status_code == 404


@pytest.mark.parametrize("value", [
    "http://pve.example:8006", "https://user:password@pve.example:8006",
    "https://pve.example:8006/api2", "https://pve.example?url=other", "https://pve.example#fragment",
])
def test_upstream_is_fixed_https_origin(value):
    with pytest.raises(ValueError):
        Settings(value)
