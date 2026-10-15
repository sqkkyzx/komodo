# zh-CN Core image (linux/amd64)

This fork builds the frontend and replaces `/app/ui` in the matching official
Core image. Core, the bundled `km` CLI, and the runtime configuration are
inherited unchanged. Use the official matching Periphery release.

This branch includes Simplified Chinese navigation, resource configuration,
Docker/Swarm pages, settings, permissions, and shared login/2FA/configuration
controls. Commands, code, resource names, API identifiers, and backend logs and
errors retain their original content.

The external `mogh_ui` package is translated during the Vite build using a
reviewed patch catalog. Package version, source hashes, and exact match counts
are checked before transformation; an upstream mismatch stops the build. Run
`corepack yarn --cwd ui check:l10n` to check the catalog and its behavioral
invariants. The image build runs the same checks before compiling the UI.

## GitHub Actions

`Publish zh-CN Core (amd64)` runs on pushes to `feat/l10n-zh-cn` that change
`ui/`, `client/core/ts/`, `docker/zh-cn/`, or the workflow itself. It only
publishes from `sqkkyzx/komodo`, using the repository's `GITHUB_TOKEN` with
`packages: write`. No personal access token is required.

The workflow loads the image into the amd64 runner, checks the Core/CLI against
the pinned base, and starts an isolated Core and MongoDB to check `/version`,
the homepage, and its JavaScript/CSS assets. It publishes the tested image only
after those checks pass, verifies its registry platform/revision, and then
updates these tags:

- `ghcr.io/sqkkyzx/komodo-core:sha-<full-commit-sha>`
- `ghcr.io/sqkkyzx/komodo-core:2.3.3-zh-cn`
- `ghcr.io/sqkkyzx/komodo-core:latest-zh-cn`

The SHA tag identifies the source commit; use the digest recorded in the run
summary to pin the exact image content. The version and rolling tags advance
as translations change. Rerunning an older commit only publishes its SHA tag
and preserves the current version and rolling tags.
The HTTP check does not replace browser testing of translated pages.

The fork's `main` stays aligned with upstream. This workflow uses push events;
rerun a past Actions run to rebuild the same commit. GitHub's manual dispatch
button requires the workflow on the default branch, so this branch does not
depend on that event.

## Build locally

Run from the repository root on a Docker host with Buildx:

```sh
docker buildx build --platform linux/amd64 --load \
  --file docker/zh-cn/Dockerfile \
  --build-arg SOURCE_REVISION="$(git rev-parse HEAD)" \
  --tag komodo-core:zh-cn-local .
bash docker/zh-cn/verify-image.sh komodo-core:zh-cn-local 2.3.3
```

The smoke check requires Docker, Bash, curl, and Python 3. Its temporary database
has no host port, and Core is exposed only on a random loopback port. Containers,
anonymous volumes, and its Docker network are removed when the check exits.

## Update the upstream release

The Dockerfile pins Node and official Core by linux/amd64 manifest digest. Both
frontend packages install with Yarn 1.22.22 and `--frozen-lockfile`. Local `.env*`,
dependencies, and build output are excluded from the Docker context, and
`VITE_KOMODO_HOST` is empty so the UI uses the deployment's own origin.

When updating upstream, update the Core reference, `KOMODO_VERSION`, and client
source together. The build rejects a client version that differs from the base
release. This packaging path only incorporates frontend/client changes; backend
changes require an updated official base or a full source build. Keep `-zh-cn`
in the image tags; changing the backend's version causes Core/Periphery version
warnings.
