Priority: 5
Topics: [bridge, packaging, chrome-extension]
GitHub: [#1720](https://github.com/framework/the-framework/issues/1720)

# Ship the bridge extension inside the framework package, so the bridge browser works from npx

## TLDR

Follow-up to #1332 / #1718. The daemon's bridge browser installs the extension from `packages/chrome-extension` beside the framework package — the checkout's copy. The published `framework` package ships `dist` only (`package.json` `files`), so an `npx the-framework` install fails the launch with "the extension files are not beside this package (packages/chrome-extension): the bridge browser runs from a checkout". Until fixed, the recommended "A browser the daemon runs" setting only works from a git checkout.

What it takes:
- Copy `packages/chrome-extension` into the package at build time (e.g. `dist/chrome-extension`); `bridgeExtensionDir()` looks there first, then the checkout path.
- The self-reload (#1712) watches its own files, so the copy under `dist` reloads on rebuild.
- Lockstep (#1519) is unaffected: the copy carries the expected version by construction.

Not the Web Store: that needs the exact-version lockstep relaxed to a minimum version first (#1519); it is the long-term path for the user's-own-Chrome option, and the daemon's browser never needs the store.

## Why it matters

Without it the daemon-owned bridge browser is a checkout-only feature — usable by the maintainers and nobody else.

## Source

Imported from GitHub issue [framework/the-framework#1720](https://github.com/framework/the-framework/issues/1720), created 2026-08-26.
