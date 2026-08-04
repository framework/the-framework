Seven ~10-line Telefunc shim files that implement nothing: each `import`s its functions from `@gemstack/the-framework/dashboard-rpc` and re-exports them.

## Problems

- Telefunc's client bakes each RPC key from the telefunc file's path relative to *this* package — but the implementations must live in the framework, where they can reach the daemon's closures (the busy guard, the start closure). These shims exist purely so the client bakes the expected keys; the framework registers the same functions under those keys at runtime.

## Decisions

- **`import` then `export` — never `export … from`**: Telefunc's dev transform appends per-export decoration that needs a local binding; the re-export form creates none, so dev answered every RPC with a ReferenceError while production never noticed. A source-shape test guards the pattern (a regex over the source, deliberately — reproducing the failure needs Vite + Telefunc + a real request, while the causing shape is plainly visible in the text), and also asserts each shim exports exactly what it imports, because an exported-but-unregistered telefunction fails at runtime as a bare 400.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
