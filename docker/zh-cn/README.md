# zh-CN Core image (linux/amd64)

This fork builds the frontend and replaces `/app/ui` in the matching official
Core image. Core, the bundled `km` CLI, and the runtime configuration are
inherited unchanged. Use the official matching Periphery release.

## Release baseline

This localization branch is based on the official **Komodo v2.3.3** release:

- Source tag: `v2.3.3`
- Source commit: `780ac68b992094a9fccd5fffb760e0c84fd3c3d1`
- Core base: `ghcr.io/moghtech/komodo-core:2.3.3@sha256:79622eea51702d1a26ceda75545594c01688ad567f36c98cbe38aa5c06cb542f`

`release.json` records this baseline. Before building, `verify-release.mjs`
checks the tag's exact commit and ancestry, unchanged backend/API client sources
and lockfiles, original UI dependency versions, and matching Dockerfile pins.
The official UI package version is `0.0.0`; the API client and running Core
version are `2.3.3`.

Use the version-specific image:

```sh
docker pull --platform linux/amd64 ghcr.io/sqkkyzx/komodo-core:2.3.3-zh-cn
```

The workflow no longer publishes or updates `latest-zh-cn`.

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
the homepage, and its JavaScript/CSS assets. The JavaScript response must contain
required Chinese login and navigation text, including when emitted as Unicode
escapes. It publishes the tested image only after those checks pass, verifies
its registry platform/revision, and then updates these tags:

- `ghcr.io/sqkkyzx/komodo-core:sha-<full-commit-sha>`
- `ghcr.io/sqkkyzx/komodo-core:2.3.3-zh-cn`

The SHA tag identifies the source commit; use the digest recorded in the run
summary to pin the exact image content. The `2.3.3-zh-cn` tag advances as
translations of this release change. Rerunning an older commit only publishes
its SHA tag and preserves the current version tag.
The HTTP check does not replace browser testing of translated pages.

The fork's `main` stays aligned with upstream. This workflow uses push events;
rerun a past Actions run to rebuild the same commit. GitHub's manual dispatch
button requires the workflow on the default branch, so this branch does not
depend on that event.

## Build locally

Run from the repository root on a Docker host with Buildx:

```sh
node docker/zh-cn/verify-release.mjs && \
docker buildx build --platform linux/amd64 --load \
  --file docker/zh-cn/Dockerfile \
  --build-arg SOURCE_REVISION="$(git rev-parse HEAD)" \
  --tag komodo-core:zh-cn-local . && \
bash docker/zh-cn/verify-image.sh komodo-core:zh-cn-local 2.3.3
```

The baseline check requires Git, Node.js, and the release tag in the local
checkout. A full clone includes the tag; for a shallow checkout, fetch its
history and tags first (`git fetch --unshallow --tags`).

The smoke check requires Docker, Bash, curl, and Python 3. Its temporary database
has no host port, and Core is exposed only on a random loopback port. Containers,
anonymous volumes, and its Docker network are removed when the check exits.

## Update the upstream release

The Dockerfile pins Node and official Core by linux/amd64 manifest digest. Both
frontend packages install with Yarn 1.22.22 and `--frozen-lockfile`. Local `.env*`,
dependencies, and build output are excluded from the Docker context, and
`VITE_KOMODO_HOST` is empty so the UI uses the deployment's own origin.

For another upstream release, start a separate localization branch from its
official release tag and port the translations. Update the workflow's branch
filter, `release.json`, the Dockerfile Core reference, and `KOMODO_VERSION`
together. Review the shared UI patch catalog against that release's locked
dependencies. Do not merge upstream `main` into this `v2.3.3` baseline.

This packaging path only replaces the frontend; backend changes require an
updated official base or a full source build. Keep `-zh-cn` in the image tags;
changing the backend's version causes Core/Periphery version warnings.
