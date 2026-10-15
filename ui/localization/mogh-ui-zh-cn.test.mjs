import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import moghUiZhCn, {
  catalog,
  translateSource,
  validateCatalog,
  verifyMoghUi,
} from "./mogh-ui-zh-cn.mjs";

const packageRoot = fileURLToPath(
  new URL("../node_modules/mogh_ui/", import.meta.url),
);
const original = (name) =>
  readFileSync(path.join(packageRoot, `dist/${name}`), "utf8");
const translated = (name) => {
  const file = catalog.files.find((file) => file.path === `dist/${name}`);
  assert.ok(file, `Missing reviewed file: ${name}`);
  return translateSource(original(name), file);
};

// These guards deliberately use the installed, locked package, not hand-written mocks.
test("all locked package files pass hashes/counts and transformed ESM parses", () => {
  const result = verifyMoghUi(packageRoot);
  assert.equal(result.version, "1.2.7");
  assert.equal(result.files, catalog.files.length);
  for (const source of result.sources.values()) {
    execFileSync(process.execPath, ["--check", "--input-type=module"], {
      input: source,
      stdio: ["pipe", "pipe", "pipe"],
    });
  }
});

test("unexpected package version, source hash and match count fail closed", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "komodo-mogh-ui-version-"));
  try {
    writeFileSync(
      path.join(directory, "package.json"),
      JSON.stringify({ name: "mogh_ui", version: "1.2.8" }),
    );
    assert.throws(() => verifyMoghUi(directory), /Expected mogh_ui@1\.2\.7/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
  const file = catalog.files[0];
  const source = readFileSync(path.join(packageRoot, file.path), "utf8");
  assert.throws(
    () => translateSource(source + "\n", file),
    /source SHA-256 differs/,
  );
  const changedCount = structuredClone(file);
  changedCount.replacements[0].count += 1;
  assert.throws(
    () => translateSource(source, changedCount),
    /expected .* matches, found/,
  );
  const overlapping = structuredClone(file);
  overlapping.replacements[1] = { ...overlapping.replacements[0] };
  assert.throws(
    () => validateCatalog({ ...catalog, files: [overlapping] }),
    /duplicate replacement/,
  );
});

test("schema rejects traversal, duplicate files and invalid counts", () => {
  const file = structuredClone(catalog.files[0]);
  assert.throws(
    () =>
      validateCatalog({
        ...catalog,
        files: [{ ...file, path: "../package.json" }],
      }),
    /Invalid or duplicate catalog file/,
  );
  assert.throws(
    () => validateCatalog({ ...catalog, files: [file, file] }),
    /Invalid or duplicate catalog file/,
  );
  file.replacements[0].count = 0;
  assert.throws(
    () => validateCatalog({ ...catalog, files: [file] }),
    /Invalid or duplicate replacement/,
  );
});

test("Vite transforms only reviewed modules and checks the source received by the hook", () => {
  const plugin = moghUiZhCn({ packageRoot });
  assert.equal(plugin.enforce, "pre");
  const file = catalog.files.find(
    (file) => file.path === "dist/auth/login/index.js",
  );
  const source = original("auth/login/index.js");
  assert.equal(plugin.transform(source, "/tmp/unrelated.js"), null);
  const result = plugin.transform(
    source,
    path.join(packageRoot, file.path) + "?v=fixture",
  );
  assert.match(result.code, /children: "登录"/);
  const devSource = source.replace(
    /\/\/# sourceMappingURL=[^\r\n]+(?=\r?\n?$)/,
    (comment) => " ".repeat(comment.length),
  );
  const devResult = plugin.transform(
    devSource,
    path.join(packageRoot, file.path),
  );
  assert.match(devResult.code, /children: "登录"/);
  assert.ok(!devResult.code.includes("sourceMappingURL="));
  assert.throws(
    () => plugin.transform(source + "\n", path.join(packageRoot, file.path)),
    /Vite source differs/,
  );
  assert.throws(
    () =>
      plugin.transform(
        devSource.replace("login(form)", "login({})"),
        path.join(packageRoot, file.path),
      ),
    /Vite source differs/,
  );
});

test("login translations preserve provider values, request names and form contracts", () => {
  const source = translated("auth/login/index.js");
  assert.match(source, /label: "用户名"/);
  assert.match(source, /label: "密码"/);
  assert.match(source, /children: "注册"/);
  for (const fragment of [
    'useLogin(\n    "LoginLocalUser"',
    'useLogin(\n    "SignUpLocalUser"',
    'getInputProps("username")',
    'getInputProps("password")',
    'getInputProps("code")',
    'autoComplete: "username"',
    'autoComplete: "password"',
    "code.length === 6",
    "localForm.onSubmit((form) => login(form))",
    "totpForm.onSubmit((form) => completeTotpLogin(form))",
  ])
    assert.ok(source.includes(fragment), fragment);
  const header = translated("auth/login/header.js");
  for (const fragment of [
    '[options?.oidc, "Oidc"]',
    '[options?.github, "Github"]',
    '[options?.google, "Google"]',
    "externalLogin(provider)",
    "children: __komodoZh(provider)",
  ]) {
    assert.ok(header.includes(fragment), fragment);
  }
  for (const name of ["passkey", "totp"]) {
    const profile = translated(`auth/profile/${name}.js`);
    assert.ok(profile.includes('confirmText: "Unenroll"'));
  }
  const linked = translated("auth/profile/linked-logins.js");
  assert.ok(linked.includes('provider === "Local"'));
  assert.ok(linked.includes("onConfirm: () => unlink({ provider })"));
  assert.ok(linked.includes('confirmText: "Unlink"'));
});

test("confirm gate and Config values remain raw while titles are localized", () => {
  const confirm = translated("components/confirm-modal.js");
  for (const fragment of [
    "input === confirmText",
    "input !== confirmText",
    "navigator.clipboard.writeText(confirmText)",
    'jsx("b", { children: confirmText })',
  ]) {
    assert.ok(confirm.includes(fragment), fragment);
  }
  assert.match(confirm, /"输入内容不匹配"/);
  const group = translated("components/config/group.js");
  for (const fragment of [
    "label: args?.label ?? __komodoZh(key)",
    "setUpdate({ [key]: Number(value2) })",
    "setUpdate({ [key]: value2 })",
  ])
    assert.ok(group.includes(fragment), fragment);
  const diff = translated("components/config/confirm.js");
  assert.ok(
    diff.includes("children: __komodoZh(fmtSnakeCaseToUpperSpaceCase(_key))"),
  );
  assert.ok(diff.includes("original: prev_val,\n            modified: val,"));
  assert.ok(diff.includes('children: prev_val || "无"'));
  assert.ok(diff.includes('children: val || "无"'));
  assert.ok(diff.includes("JSON.stringify(_val, null, 2)"));
});

test("Create, theme and tabs translate labels while retaining their stable values", () => {
  const create = translated("components/create-modal.js");
  assert.ok(create.includes("title: `新建${__komodoZh(entityType)}`"));
  assert.ok(
    create.includes(
      "`请为新${__komodoZh(entityType)}输入${__komodoZh(configureLabel)}。`",
    ),
  );
  assert.ok(create.includes("configSection(close)"));
  assert.ok(
    create.includes("onConfirm().then((success) => success && close())"),
  );
  const theme = translated("components/theme-toggle.js");
  assert.ok(theme.includes('["light", "dark", "auto"]'));
  assert.ok(theme.includes("setColorScheme(theme)"));
  assert.ok(theme.includes("children: __komodoZh(theme)"));
  const tabs = translated("components/mobile-friendly-tabs.js");
  assert.ok(
    tabs.includes(
      "value: tab.value,\n            label: tab.label ?? __komodoZh(tab.value)",
    ),
  );
  assert.ok(tabs.includes("onClick: () => onValueChange(tabValue)"));
});

test("date and duration translations retain local/UTC getters and numeric calculations", async () => {
  const source = translated("formatting.js");
  const formatting = await import(
    `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
  );
  const date = new Date("2026-01-02T03:04:00Z");
  const pad = (value) => String(value).padStart(2, "0");
  assert.equal(
    formatting.fmtDate(date),
    `${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`,
  );
  assert.equal(formatting.fmtUtcDate(date), "1月2日 03:04");
  assert.equal(
    formatting.fmtDateWithMinutes(date),
    date.toLocaleString("zh-CN"),
  );
  assert.equal(formatting.fmtDuration(0, 125000), "2 分钟 5 秒");
  assert.equal(formatting.fmtDuration(0, 1500), "1.5 秒");
});
