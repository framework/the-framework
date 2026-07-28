Private workspace package `@gemstack/example-framework-demo`: the showable end-to-end demo of `@gemstack/the-framework` — one prompt → scope → architect → build → full-fledged loop → deploy → a real running app, offline via the fake driver.

## TLDR

- `src/` — the demo flow, CLI entry, and smoke test.
- `package.json` — `start` (`tsx src/main.ts`), `test` (compile to `dist-test` + `node --test`); depends on `@gemstack/the-framework` + `@gemstack/ai-autopilot`.
- `README.md` — sample output and the two genuinely-real parts (the serving app, the real `cloudflareTarget` adapter).
