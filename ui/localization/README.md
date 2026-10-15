# Shared UI localization

Komodo imports `mogh_ui@1.2.7` for login, two-factor authentication, profile,
confirmation and creation dialogs, configuration controls, tables, tabs, themes,
and date/duration formatting. `mogh-ui-zh-cn.mjs` applies the reviewed display
changes in `mogh-ui.zh-cn.json` through a Vite `enforce: "pre"` plugin.

The catalog records each upstream ESM file's SHA-256 and each exact `from` / `to`
fragment with its expected match count. Vite startup and builds verify the
installed package version and **every** catalog file, including unused modules.
The transform checks the original file again and accepts only that source or
Vite dev's exact blanking of its trailing `sourceMappingURL` comment. A package
upgrade, unexpected content, missing fragment, overlapping rule, or changed
match count fails the build instead of silently shipping partial localization.
The plugin does not write to `node_modules`.

Run from the repository root after installing the locked UI dependencies:

```sh
node ui/localization/check-mogh-ui.mjs
node --test ui/localization/mogh-ui-zh-cn.test.mjs
```

`yarn build` and `yarn dev` in `ui/` run the same guard automatically.
The tests use the real installed ESM files and check transformed JavaScript
syntax, failing guards, login form/request contracts, confirmation matching,
configuration values, stable theme/tab values, and local versus UTC formatting.

Rules are deliberately limited to display text. Authentication provider values,
API names, usernames/passwords, verification/recovery codes, `confirmText`,
configuration keys/values, editor contents, and callback arguments remain raw.
Dynamic labels use the application's pure `displayLabel` helper. Date formatters
keep their existing local/UTC getters; specifying `zh-CN` does not set a timezone.

When upgrading `mogh_ui`, review the installed source changes and the affected
UI in a browser before updating the catalog, package version guard, and tests.
Do not regenerate hashes or counts merely to silence a failure. Keep the exact
source fragments small enough to review, and never translate request data or
confirmation values to make a display label Chinese.
