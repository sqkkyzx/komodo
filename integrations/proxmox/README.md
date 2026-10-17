# PVE Docker 管理扩展（0.2.0）

用 FastAPI 为现有 PVE 9 桌面添加“数据中心 → Docker 管理”原生 ExtJS 菜单。
页面提供“检查连接”，复用当前 PVE 登录检查服务端配置的 Komodo 连接，显示连接状态
与版本。无需在扩展中再次登录 Komodo。
本版没有 Docker/Stack 操作或 VM/CT 资源绑定。
PVE 的官方文件、API、VM/CT 配置均不修改。

## 结构

现有 Nginx 的主桌面 `/` 请求经过本服务，从固定的 `PVE_UPSTREAM` 取得动态 HTML，
在官方 `pvemanagerlib.js` 加载后、`PVE.StdWorkspace` 初始化前插入扩展脚本。
PVE 继续生成登录用户、CSRF、节点、语言和主题信息。每次取页面使用独立 Cookie 会话，
动态 HTML 不缓存，不记录请求 Cookie、票据或页面内容。

其他 PVE API、官方资源、上传下载和控制台 WebSocket 仍由 Nginx **直接代理 PVE**。
本服务不是完整的 PVE 反向代理，直接访问容器端口不能代替完整的 Nginx 入口。
noVNC、xterm.js、移动页面跳过扩展加载。

扩展只 override `PVE.dc.Config.insertNodes`：该钩子在数据中心构造菜单时追加连接检查面板，
不修改 VM/CT 页面。普通 script 保留 ExtJS `callParent` 所需的非 strict 调用语义。

## 镜像与构建

工作流：`.github/workflows/publish-pve-webui.yml`。
本分支提交推送后，GitHub Actions 执行 Python/Node 测试、构建 linux/amd64 镜像、
容器启动和静态资源检查，成功后发布：

```text
ghcr.io/sqkkyzx/pve-komodo-webui:edge
ghcr.io/sqkkyzx/pve-komodo-webui:sha-<完整提交 SHA>
```

使用 Actions 摘要中的 digest 或 SHA 标签固定部署版本，`edge` 用于跟随本分支。
无需在部署机器构建镜像。如果 GHCR 包尚为私有，拉取前需要使用有 `read:packages`
权限的账号凭据执行 `docker login ghcr.io`。

## 部署

把本目录的 `compose.yaml`、`.env.example` 复制到 Docker 主机。配置 `.env`：

```sh
cp .env.example .env
# 编辑 PVE_UPSTREAM、镜像版本、管理员名单、Komodo 配置和 TLS 设置
docker compose pull
docker compose up -d
curl -f http://127.0.0.1:18080/pve-komodo/health
```

`health` 仅表示本服务存活，不表示上游 PVE 连通或页面已经注入。
默认只绑定本机 `127.0.0.1:18080`，适用于 Nginx 在同一机器运行。
如果 Nginx 在其他容器或机器，通过现有私有网络连接本服务，或设置内部绑定地址；
不需要 privileged、宿主机目录、Docker socket 或 PVE SSH 凭据。

### Komodo 服务端配置

Compose 的 `environment` 直接使用变量插值：

```yaml
PVE_ADMIN_USERS: ${PVE_ADMIN_USERS:-root@pam}
KOMODO_URL: ${KOMODO_URL:-}
KOMODO_API_KEY: ${KOMODO_API_KEY:-}
KOMODO_API_SECRET: ${KOMODO_API_SECRET:-}
KOMODO_TLS_VERIFY: ${KOMODO_TLS_VERIFY:-true}
```

可在部署文件对应的 `.env` 中提供值，或在自己的 Compose `environment` 中直接填写。
示例中的 API 密钥和机密为空，不包含真实凭据。`KOMODO_URL`、`KOMODO_API_KEY`、
`KOMODO_API_SECRET` 三项齐全后才会执行连接检查。`KOMODO_URL` 是固定的 HTTP/HTTPS
origin，不能包含用户名密码、额外路径、查询参数或 fragment。

`.env.example` 中的 `http://core:9120` 是 Docker 服务名示例；扩展与 Komodo Core
必须加入同一个 Docker 网络，且实际服务名为 `core`，才能使用此地址。也可改为从扩展
容器能够访问的 Core 内网地址。`KOMODO_TLS_VERIFY` 默认 `true`，使用 HTTPS 时验证
Komodo 证书；此设置与 PVE 的 TLS 设置独立。

API 密钥可从 Komodo 的 **Profile → API Keys** 创建；也可由管理员在
**设置 → 用户** 中创建专用服务用户，再从该用户页面的 **API Keys** 创建。
创建时复制密钥和机密；机密只显示一次，请当场妥善保存。API 密钥继承所属 Komodo
账号的权限，建议为集成使用权限范围明确的服务用户。密钥与机密只保存在服务端配置，
不会作为连接检查结果返回浏览器。

### PVE 会话与接口权限

`PVE_ADMIN_USERS` 是逗号分隔的完整 PVE 用户 ID 白名单，默认 `root@pam`，例如
`root@pam,operator@pve`。白名单中的用户还必须在 PVE 根路径 `/` 具有 `Sys.Audit`。
仅登录 PVE 不会自动获得扩展访问权限。

两个接口均为只读：

| 接口 | 用途 |
| --- | --- |
| `GET /pve-komodo/api/session` | 确认当前 PVE 用户与 Komodo 是否已配置 |
| `GET /pve-komodo/api/connection` | 确认 Komodo 凭据有效、账号已启用，并读取版本 |

每次调用都先从当前浏览器的 `PVEAuthCookie` 取得票据，并检查用户白名单；随后将
**原始 Cookie 值**发给固定 PVE 上游的 `GET /api2/json/access/permissions`，确认用户
有效且已完成完整登录（包括启用的双因素认证）。再对同一上游调用
`POST /api2/json/access/ticket`，固定提交 `path=/` 和 `privs=Sys.Audit`，仅验证票据
身份与权限，不续签或创建票据。验证成功后才允许使用服务端 Komodo 凭据。

Komodo 连接检查只调用固定的 `GET /user` 与 `GET /version`，PVE Cookie 不会发给
Komodo，Komodo 凭据不会发给 PVE。接口不是通用 RPC 或任意上游代理，不提供 Docker
动作；未来增加写接口时还必须实现 CSRF 校验。连接失败只返回非敏感错误码，接口响应
禁止缓存。`health` 无需登录，仅报告扩展服务存活。

### TLS

默认验证 PVE HTTPS 证书。PVE 使用自签 CA 时，挂载该 CA 的 **公开证书**（无需私钥）：

```yaml
# compose.override.yaml
services:
  pve-komodo:
    environment:
      PVE_CA_FILE: /run/pve-ca.pem
    volumes:
      - ./pve-ca.pem:/run/pve-ca.pem:ro
```

`PVE_UPSTREAM` 的主机名必须匹配证书。临时测试可显式设置 `PVE_TLS_VERIFY=false`，
此时不能同时配置 `PVE_CA_FILE`；部署时应恢复证书验证。

### 现有 Nginx

参考 `nginx.example.conf`，在现有 Nginx 中添加增强域名的 server 配置：

| 路径 | 上游 |
| --- | --- |
| `location = /` | 本服务 `http://127.0.0.1:18080`，保留完整 query string |
| `/pve-komodo/` | 本服务，提供脚本、健康检查、会话及连接检查 |
| 其余路径 | 原 PVE `https://节点:8006`，保留原有 WebSocket/上传配置 |

替换示例中的域名、TLS 证书、CA 和上游地址，先 `nginx -t` 再 reload。
保留原始 `https://节点:8006` 管理入口。不要缓存含用户信息的 PVE 首页。
示例在本服务不可达时将首页回退到原 PVE；PVE 本身不可达时无法靠扩展恢复。
转发 `/pve-komodo/api/` 时须保留浏览器 Cookie，不要缓存接口结果。

## 兼容与停用恢复

注入条件为 PVE **9.x** 的已识别桌面结构（官方 manager script + 唯一 StdWorkspace
启动脚本）；其他主版本、未知模板、控制台和移动页面原样返回。此结构检查不是对所有
PVE 9 小版本的兼容承诺。实现依据为官方 PVE 9.2.22 源码，实机验收需在目标节点进行。
宿主机的软件升级照常执行；页面结构失配时不会强行注入。

- 临时绕过：访问增强入口 `/?pve-komodo=off`（这是本服务提供的开关，不是 PVE 内置功能）。
- 全局停用：`.env` 设置 `PVE_EXTENSION_ENABLED=false`，再 `docker compose up -d`，刷新页面。
- 取消集成：把 Nginx 的 `location = /` 改回原 PVE 上游，检查配置后 reload，然后停止扩展容器。
- 紧急入口：直接访问原 PVE `:8006`，或使用独立 SSH；不依赖扩展容器。
- 版本恢复：将 `PVE_EXTENSION_IMAGE` 改为上一版 SHA/digest，拉取并重建服务。

如果开发时挂载了源码，版本恢复还需同时恢复对应版本的 `app/`、`static/`，或取消
源码挂载及开发用 `command`。挂载内容会覆盖镜像文件，仅切回旧镜像无法恢复代码。

停用后需刷新已打开的页面，已加载进浏览器的 override 不会从旧页面中自动卸载。
关闭扩展不会执行任何 VM/CT、Docker 或存储操作。浏览器脚本运行时异常仍可能影响
增强入口；原版入口作为独立的恢复路径保留。

响应头 `X-PVE-KOMODO-Extension` 给出 `enabled`、`disabled`、`console-or-mobile`、
`unsupported-page` 等判定，便于在浏览器 Network 中排查。

## 验证

### 开发时挂载源码

可以在开发机器用 `compose.override.yaml` 挂载 `app/`、`static/` 并启用 Uvicorn reload，
镜像仍使用 GitHub Actions 的成品，无需本地构建：

```yaml
services:
  pve-komodo:
    volumes:
      - ./app:/app/app:ro
      - ./static:/app/static:ro
    command:
      - uvicorn
      - app.main:create_app
      - --factory
      - --host
      - 0.0.0.0
      - --port
      - '8000'
      - --no-access-log
      - --no-proxy-headers
      - --reload
      - --reload-dir
      - /app/app
```

Python 源码变更会触发服务重启。静态脚本变更后刷新浏览器；如需重新计算首页中的
脚本版本参数，执行 `docker compose restart pve-komodo`。部署机器上保留可读源码，
不挂载 PVE 宿主机目录或 Docker socket。生产使用不可变镜像时移除开发覆盖配置。

### 自动与实机验证

本地可运行代码检查与单元测试；镜像仅在 GitHub Actions 构建：

```sh
python -m pip install -r requirements-dev.txt
python -m pytest -q
node --test tests/test_extension.mjs
```

测试覆盖菜单插入顺序、原菜单与 VM/CT 页面保留、重复注入、连接检查交互、Cookie
隔离、PVE 会话与白名单、CSRF 内容保留、Komodo 凭据与上游隔离、错误脱敏、压缩
与缓存头、控制台跳过、未知模板跳过、停用及上游断连。
首次接入目标 PVE 后，验收登录、允许用户的连接检查、非白名单及过期登录拒绝访问、
原 VM/CT 页面、控制台与停用回退。修改凭据后需重建容器，确认连接显示的 Komodo
账号符合预期（连接接口返回账号，页面显示版本）；仅 `health` 成功不能代替此项验收。

实现依据：[PVE 桌面模板](https://github.com/proxmox/pve-manager/blob/aa7db891073e78fe1b67032be71ee9c98b6eb635/www/index.html.tpl)、
[数据中心配置](https://github.com/proxmox/pve-manager/blob/aa7db891073e78fe1b67032be71ee9c98b6eb635/www/manager6/dc/Config.js)、
[ConfigPanel 菜单构造](https://github.com/proxmox/pve-manager/blob/aa7db891073e78fe1b67032be71ee9c98b6eb635/www/manager6/panel/ConfigPanel.js)。
