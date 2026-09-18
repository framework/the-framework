The two scripts the framework package's own build and test commands call: the copy that puts the Claude web bridge [1] extension inside the published package, and the test runner that keeps the package's test suite away from the machine's real configuration. `run-tests.BUG-ANALYSIS.md` is an analysis note holding only the date of its last analysis and carries no business logic.

## Glossary

[1] Claude web bridge: the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session.

## Business logic — TL;DR

- **Shipping the bridge extension** (`copy-extension.mjs`) - every build replaces `dist/chrome-extension` with the extension's files, exactly the files the extension's self-reload watches, so the daemon's bridge browser works from an installed package and not only from a checkout.
- **Running the tests in isolation** (`run-tests.mjs`) - the compiled test suite runs under Node's test runner against a throwaway configuration home, so no test reads the real registry or attaches to a live daemon, with 60 seconds per test and the runner's exit code reported as the script's own.
