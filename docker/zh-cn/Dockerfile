# UI-only image: keep Core and its bundled CLI identical to the official release.
# Both digests below select linux/amd64 manifests, not floating image indexes.
ARG NODE_IMAGE=node:24.21.0-bookworm-slim@sha256:51b1100cc2a83d370c6a60952e3f2989c8a43159d0e38586e090f3b3326efefd
ARG CORE_IMAGE=ghcr.io/moghtech/komodo-core:2.3.3@sha256:79622eea51702d1a26ceda75545594c01688ad567f36c98cbe38aa5c06cb542f
ARG KOMODO_VERSION=2.3.3

FROM ${NODE_IMAGE} AS ui-builder
ARG TARGETPLATFORM
ARG KOMODO_VERSION
RUN test "$TARGETPLATFORM" = "linux/amd64" && test "$(yarn --version)" = "1.22.22"

WORKDIR /builder/client
COPY client/core/ts/package.json client/core/ts/yarn.lock ./
RUN yarn install --frozen-lockfile --non-interactive
COPY client/core/ts/ ./
RUN node -e 'if (JSON.parse(require("fs").readFileSync("package.json")).version !== process.env.KOMODO_VERSION) throw new Error("Client version must match the pinned Core release")' \
    && yarn build

WORKDIR /builder/ui
COPY ui/package.json ui/yarn.lock ./
RUN yarn install --frozen-lockfile --non-interactive
COPY ui/ ./
# Keep the client link local to the builder and use the deployment's own origin.
ENV VITE_KOMODO_HOST=""
RUN ln -s ../../client node_modules/komodo_client && yarn build

FROM ${CORE_IMAGE}
ARG CORE_IMAGE
ARG KOMODO_VERSION
ARG SOURCE_REVISION=unknown
ARG SOURCE_REPOSITORY=https://github.com/sqkkyzx/komodo
RUN rm -rf /app/ui && mkdir -p /app/ui
COPY --from=ui-builder /builder/ui/dist/ /app/ui/

LABEL org.opencontainers.image.source="${SOURCE_REPOSITORY}" \
      org.opencontainers.image.revision="${SOURCE_REVISION}" \
      org.opencontainers.image.version="${KOMODO_VERSION}" \
      org.opencontainers.image.base.name="${CORE_IMAGE}" \
      org.opencontainers.image.description="Komodo Core with the zh-CN frontend build" \
      org.opencontainers.image.licenses="GPL-3.0"
