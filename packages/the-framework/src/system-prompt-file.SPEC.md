Reads the user's own system prompt — the workspace-root `SYSTEM.md` — off disk. An absent or empty file yields nothing, so the caller falls back to the built-in system prompt alone. Kept apart from the prompt composition itself so the dashboard can render the full prompt in the browser: composition stays free of filesystem access, and everything read here is handed to it as plain text.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
