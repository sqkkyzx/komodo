import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

try {
  const release = JSON.parse(read("docker/zh-cn/release.json"));
  assert.match(release.version, /^\d+\.\d+\.\d+$/);
  assert.equal(release.tag, `v${release.version}`, "The baseline must be a versioned release tag.");
  assert.match(release.commit, /^[a-f0-9]{40}$/);
  assert.match(
    release.core_image,
    new RegExp(`^ghcr\\.io/moghtech/komodo-core:${release.version.replaceAll(".", "\\.")}@sha256:[a-f0-9]{64}$`),
    "The official Core image must pin the same release and an immutable digest.",
  );
  assert.equal(
    git("rev-parse", `refs/tags/${release.tag}^{commit}`),
    release.commit,
    "The release tag differs from the recorded official commit. Fetch the release tags before building.",
  );
  git("merge-base", "--is-ancestor", release.commit, "HEAD");

  // The official base supplies the backend. Keep its source, API client, and
  // dependency locks at the selected release while translating the frontend.
  const protectedPaths = [
    ".cargo", "Cargo.toml", "Cargo.lock", "bin", "lib", "client", "config",
    "xtask", "typeshare.toml", "ui/yarn.lock",
  ];
  const changed = git("diff", "--name-only", release.commit, "--", ...protectedPaths);
  assert.equal(changed, "", `Source or locks differ from ${release.tag}:\n${changed}`);
  const untracked = git("ls-files", "--others", "--exclude-standard", "--", ...protectedPaths);
  assert.equal(untracked, "", `Untracked source files differ from ${release.tag}:\n${untracked}`);

  const client = JSON.parse(read("client/core/ts/package.json"));
  assert.equal(client.version, release.version, "The API client must match the release.");
  const ui = JSON.parse(read("ui/package.json"));
  const originalUi = JSON.parse(git("show", `${release.commit}:ui/package.json`));
  for (const field of ["version", "dependencies", "devDependencies", "packageManager"]) {
    assert.deepEqual(ui[field], originalUi[field], `UI ${field} differs from ${release.tag}.`);
  }

  const dockerfile = read("docker/zh-cn/Dockerfile");
  assert.equal(dockerfile.match(/^ARG CORE_IMAGE=(.+)$/m)?.[1], release.core_image,
    "The Dockerfile base must match release.json.");
  assert.equal(dockerfile.match(/^ARG KOMODO_VERSION=(.+)$/m)?.[1], release.version,
    "The Dockerfile version must match release.json.");

  console.error(`Verified official ${release.tag} (${release.commit}), unchanged backend/client, and pinned dependencies/base.`);
  // Also usable as GitHub Actions step outputs; no output is emitted on failure.
  console.log(`version=${release.version}\ntag=${release.tag}\ncommit=${release.commit}`);
} catch (error) {
  console.error(`Release baseline verification failed: ${error.message}`);
  process.exitCode = 1;
}
