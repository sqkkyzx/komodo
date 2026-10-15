import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import catalog from "./mogh-ui.zh-cn.json" with { type: "json" };

const PREFIX = "[mogh_ui zh-CN]";
const fail = (message) => {
  throw new Error(`${PREFIX} ${message}`);
};
const hash = (source) => createHash("sha256").update(source).digest("hex");
const occurrences = (source, fragment) => source.split(fragment).length - 1;

/** Keep this overlay limited to explicitly reviewed ESM display fragments. */
export function validateCatalog(candidate = catalog) {
  if (
    candidate?.schemaVersion !== 1 ||
    candidate.package?.name !== "mogh_ui" ||
    candidate.package?.version !== "1.2.7" ||
    !Array.isArray(candidate.files) ||
    candidate.files.length === 0
  ) {
    fail("Invalid catalog schema or unreviewed package version.");
  }
  const paths = new Set();
  for (const file of candidate.files) {
    if (
      !file ||
      typeof file !== "object" ||
      !/^dist\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.js$/.test(file.path) ||
      paths.has(file.path) ||
      !/^[a-f0-9]{64}$/.test(file.sha256) ||
      !Array.isArray(file.replacements) ||
      file.replacements.length === 0
    ) {
      fail(`Invalid or duplicate catalog file: ${file.path}`);
    }
    paths.add(file.path);
    const fragments = new Set();
    for (const rule of file.replacements) {
      if (
        !rule ||
        typeof rule !== "object" ||
        typeof rule.from !== "string" ||
        rule.from.length === 0 ||
        typeof rule.to !== "string" ||
        rule.from === rule.to ||
        !Number.isInteger(rule.count) ||
        rule.count < 1 ||
        fragments.has(rule.from)
      ) {
        fail(`Invalid or duplicate replacement in ${file.path}`);
      }
      fragments.add(rule.from);
    }
  }
  return candidate;
}

/** Hash and match counts fail closed before any replacement is applied. */
export function translateSource(source, file) {
  if (hash(source) !== file.sha256) {
    fail(
      `${file.path}: source SHA-256 differs; review the installed package before updating the catalog.`,
    );
  }
  for (const rule of file.replacements) {
    const actual = occurrences(source, rule.from);
    if (actual !== rule.count) {
      fail(
        `${file.path}: expected ${rule.count} matches, found ${actual} for ${JSON.stringify(rule.from)}.`,
      );
    }
  }
  let translated = source;
  for (const rule of file.replacements) {
    if (occurrences(translated, rule.from) !== rule.count) {
      fail(`${file.path}: replacement rules overlap.`);
    }
    translated = translated.replaceAll(rule.from, rule.to);
  }
  return translated;
}

/** Verify every catalog entry, including modules not imported by this build. */
export function verifyMoghUi(packageRoot, candidate = catalog) {
  validateCatalog(candidate);
  const manifest = JSON.parse(
    readFileSync(path.join(packageRoot, "package.json"), "utf8"),
  );
  if (
    manifest.name !== candidate.package.name ||
    manifest.version !== candidate.package.version
  ) {
    fail(
      `Expected ${candidate.package.name}@${candidate.package.version}, found ${manifest.name}@${manifest.version}.`,
    );
  }
  const sources = new Map();
  for (const file of candidate.files) {
    const source = readFileSync(path.join(packageRoot, file.path), "utf8");
    sources.set(file.path, translateSource(source, file));
  }
  return {
    version: manifest.version,
    files: sources.size,
    replacements: candidate.files.reduce(
      (sum, file) => sum + file.replacements.length,
      0,
    ),
    sources,
  };
}

// Vite dev blanks the trailing source-map comment before user transform hooks.
// Accept that exact loader change only; all executable text must still match.
const blankSourceMapComment = (source) =>
  source.replace(/\/\/# sourceMappingURL=[^\r\n]+(?=\r?\n?$)/, (comment) =>
    " ".repeat(comment.length),
  );

export default function moghUiZhCn({ packageRoot }) {
  const root = realpathSync(packageRoot);
  // This runs while Vite loads its config, so dev startup also checks all files.
  verifyMoghUi(root);
  const entries = new Map(
    catalog.files.map((file) => [path.join(root, file.path), file]),
  );
  return {
    name: "komodo-mogh-ui-zh-cn",
    enforce: "pre",
    buildStart() {
      verifyMoghUi(root);
    },
    transform(source, id) {
      const file = entries.get(id.split("?")[0]);
      if (!file) return null;
      const original = readFileSync(path.join(root, file.path), "utf8");
      const translated = translateSource(original, file);
      if (source === original) return { code: translated, map: null };
      if (source === blankSourceMapComment(original)) {
        return { code: blankSourceMapComment(translated), map: null };
      }
      fail(
        `${file.path}: Vite source differs beyond the expected source-map comment.`,
      );
    },
  };
}

export { catalog };
