GitHub: [#1720](https://github.com/framework/the-framework/issues/1720)
PR: [#1789](https://github.com/framework/the-framework/pull/1789)

# Ship the bridge extension inside the framework package, so the bridge browser works from npx

## TLDR

Follow-up to #1332/#1718. The daemon's bridge browser installs the extension from `packages/chrome-extension`, which only exists in a checkout. The published package ships `dist` only, so on `npx the-framework` the recommended Settings option "A browser the daemon runs" fails: "the extension files are not beside this package". What it takes:
- Copy `packages/chrome-extension` into the package at build time (e.g. `dist/chrome-extension`), and have `bridgeExtensionDir()` look there first, then in the checkout.
- The self-reload (#1712) watches its own files, so the copy reloads when the package is rebuilt.
- The version lockstep (#1519) is unaffected: the copy carries the version the daemon expects.

Out of scope: the Web Store. That needs the lockstep relaxed to a minimum version first, and it is the path for the user's-own-Chrome option.

## Why it matters

Until this is done, the recommended bridge browser only works for people running from a git checkout, which today means only the maintainers.

## Source

Imported from GitHub issue [framework/the-framework#1720](https://github.com/framework/the-framework/issues/1720), created 2026-08-26, no labels, 0 comments.
