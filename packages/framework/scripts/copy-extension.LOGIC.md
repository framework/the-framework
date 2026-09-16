Puts the Claude web bridge [1] extension inside the framework package, so the daemon's bridge browser [2] works for a user who runs The Framework from an installed package, not only from a checkout.

## Glossary

[1] Claude web bridge: the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session.
[2] bridge browser: the Chrome for Testing the daemon runs for the bridge.

## Business logic — TL;DR

- **The copy** - every build replaces `dist/chrome-extension` with exactly the files the extension's self-reload watches, read from the extension's own list.

## Business logic

### The copy

#### Context

**Problem**: the published package holds only its `dist` folder, and the extension lives beside the package in the repository. The extension's self-reload fingerprints a fixed list of its own files, and a file it cannot read switches the self-reload off without any error, so a copy that missed a file would break it silently.

#### Business logic

The script reads the list of watched files from the extension's own fingerprint script (the manifest, the service worker and what it loads, the content script, the options page and its script), removes the target folder, and copies each listed file into it. A listed file that is missing fails the build. The target is `dist/chrome-extension`, or the folder given as the first argument. The package's build runs it after compiling; development watch, tests and type checks do not.
