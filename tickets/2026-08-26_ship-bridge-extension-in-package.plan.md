Effort: 2
Uncertainty: 3

# [Plan] Ship the bridge extension inside the framework package, so the bridge browser works from npx

A concrete plan: copy the extension into `dist/` at build time, and install it from a fixed place in the bridge browser's own folder.

## TLDR

- The build copies the extension's seven runtime files into `packages/framework/dist/chrome-extension/`. `files: ["dist"]` then ships them with no change.
- `bridgeExtensionDir()` looks at the checkout first, then at the `dist` copy.
- Before each launch, the daemon copies those files into `<bridge dir>/extension/` and installs from there. The path then stays the same across versions and npx cache folders, so the extension id stays the same too.

## Facts (main 9bb62321)

- `packages/framework/src/bridge-browser.ts:70` `bridgeExtensionDir()` resolves `../../chrome-extension/` from the compiled file. From `dist/bridge-browser.js` that is `packages/chrome-extension/` in a checkout. In an installed package it is `node_modules/chrome-extension/`, which normally does not exist. When it is missing, `startBridgeBrowser` throws at `:413`.
- `packages/framework/package.json` ships `files: ["dist"]`. `build` = sibling builds + `gen-prompts.mjs` + `tsc` + dashboard `vite build`. Nothing copies the extension.
- `installExtension` (`:150`) calls CDP `Extensions.loadUnpacked { path }`. Chrome derives an unpacked extension's id from its absolute path.
- `seedExtension` (`:212`) writes the daemon URL and token into the extension's storage on every launch. A new id therefore still gets its token.
- The self-reload (#1711/#1712) fingerprints `WATCHED_FILES` (`packages/chrome-extension/fingerprint.js:13`): `manifest.json, background.js, driver-plan.js, fingerprint.js, content.js, options.html, options.js`. A file it cannot fetch fails the whole fingerprint, and `filesChanged()` then returns `[]` every beat. So if the copy leaves out a watched file, the self-reload turns off without any error.
- Lockstep (#1519): `EXPECTED_EXTENSION_VERSION = '0.12.0'` (`src/dashboard/bridge-endpoints.ts:37`). `bridge-endpoints.test.ts:328` checks it against `packages/chrome-extension/manifest.json`. The copy carries the same manifest, so the lockstep holds.
- The extension folder has no `package.json` on purpose (`check.mjs` comment). Its `.md` files and `check.mjs` are not runtime files.

## Problems

1. **Which folder wins in a checkout (uncertainty 3).** The ticket says to look in `dist` first. But a checkout that has been built has a stale `dist` copy. If `dist` wins, edits to `packages/chrome-extension` no longer reach the running browser until someone rebuilds. That breaks the edit-in-place flow the self-reload exists for.
2. **The id changes on every npx version (uncertainty 3).** npx installs each version under its own `~/.npm/_npx/<hash>/` folder. Installing straight from the package path gives each version a new id. The profile then keeps one dead unpacked entry per old version, and each of them shows an error on chrome://extensions. It works, but it is clutter in a profile the user signs in to and looks at.
3. **Copy list drift (uncertainty 1).** A file added to the extension but not to the copy is exactly the silent failure described above.

## Solutions

1. Checkout first, then `dist`:
   - a. **(pick)** Checkout first. The edit-in-place flow keeps working, and an installed package falls through to `dist`. To guard against an unrelated `node_modules/chrome-extension` package, the checkout candidate counts only when its `manifest.json` `name` is the bridge's name (`"The Framework: Claude web bridge"`).
   - b. `dist` first, as the ticket says. That needs a rebuild after every extension edit, which is a regression for maintainers. Rejected.
2. A stable install path:
   - a. **(pick)** Before the spawn, copy the chosen folder's runtime files into `join(opts.dir, 'extension')` and install from there. The id then never changes. On a newer version, the next launch overwrites the files. The browser is not running yet at that point, so nothing reloads mid-cycle.
     - The cost in a checkout: an edit to `packages/chrome-extension` reaches the running browser only after a restart, because the browser watches the copy.
     - To keep live edits, skip the copy when the source is the checkout and install the checkout path directly, as today. Its path is already stable.
   - b. Install from the package path, and before that remove stale unpacked copies with the same name through CDP (`Extensions.uninstall`, recent Chrome only). More moving parts. Rejected.
   - c. Accept the clutter. Simplest shortcut, and acceptable if (a) proves awkward.
3. Build the copy list from `WATCHED_FILES`, not from a second list. The copy script loads `fingerprint.js` and reads the constant; it is a plain script, so either evaluate it in `node:vm` or match the array with a regex. Also add a test that every file in `WATCHED_FILES` exists in `dist/chrome-extension/` after a build.

## Considerations

- `dev` (`tsc --watch`) does not copy. With 1a, dev uses the checkout, so no copy is needed.
- `pnpm clean` removes `dist`, and the copy with it.
- `npm pack --dry-run` in `packages/framework` should list `dist/chrome-extension/manifest.json`. This is the check to run before publishing.
- The Settings error text at `:413` names a checkout. It becomes: `the extension files are missing from this package (dist/chrome-extension)`.
- The doc comments at `:66-69` and `:399` say the bridge browser is a checkout feature. Rewrite them.
- `packages/chrome-extension/README.md` "Set it up" assumes a checkout for the manual way. The short way now works from npx; say so.
- FEATURES-SPEC.md: AGENTS.md requires it, but it is gone (see the memory note for #1774). If it exists again at build time, record the bridge browser as working from npx.
- LOGIC.md files: `bridge-browser.LOGIC.md` and `scripts/LOGIC.md` describe these functions and the scripts. Update them per the logic-driven-development skill.
- The Web Store stays out of scope, as the ticket says.

## Implementation

1. `packages/framework/scripts/copy-extension.mjs`:
   - read `WATCHED_FILES` from `../chrome-extension/fingerprint.js`;
   - `rm -rf dist/chrome-extension`, then copy each file into it;
   - fail if a file is missing.
   Add it to `build` after `tsc`. It is not needed in `dev`, `test` or `typecheck`.
2. `bridge-browser.ts`:
   - `bridgeExtensionDir()` returns the first match of: the checkout folder, when its manifest name matches; `new URL('./chrome-extension/', import.meta.url)`, the `dist` copy.
   - Export a small `extensionSource()`, or have the function return `{ dir, checkout: boolean }`, so the launch knows whether to copy.
3. `startBridgeBrowser`: when the source is not the checkout, copy the watched files into `join(opts.dir, 'extension')`, overwriting them, and pass that path to `installExtension`. Update the error message and the doc comments.
4. Tests (`bridge-browser.test.ts`):
   - keep "the extension is the checkout's";
   - add: a checkout candidate with a foreign manifest name is skipped;
   - add: the launch installs from `<dir>/extension` when the source is a package copy, using the existing fake CDP (`options()` at `:146`).
   - `scripts/run-tests.mjs` or a small node test: after `copy-extension.mjs` runs into a temp dir, every watched file is there.
5. Update the docs as listed in Considerations.
6. Verify:
   - `pnpm -C packages/framework build`;
   - `npm pack` into a temp folder, install the tarball in a scratch project, and run `npx the-framework` from there;
   - turn on the bridge browser in Settings and see it reach `running`;
   - on chrome://extensions, the extension path is `<bridge dir>/extension`.
