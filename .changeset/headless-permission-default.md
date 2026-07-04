---
'@gemstack/framework': patch
---

Default the CLI to bypassPermissions so the headless loop can build/verify

Every framework turn is a headless `claude -p` invocation, which can't answer an
interactive approval. The driver's library default (`acceptEdits`) auto-approves
edits but not Bash, so installs/builds/tests were silently denied: the
production-grade checklist tried `npm run build` / dev-boot, hit "Build needs
interactive approval which isn't available," failed pass 1 as "could not be
executed this session," and the loop ground on listing blockers it couldn't
verify.

The `framework` CLI now defaults its Claude Code driver to `bypassPermissions` so
the full loop (install, build, test, dev-boot) runs unattended and the checklist
verifies for real. This is a permissive default appropriate to a headless
autonomous builder; `--permission-mode <mode>` still overrides it (e.g.
`--permission-mode acceptEdits` for the old, conservative behavior), and
`--dangerously-skip-permissions` still takes precedence. The `ClaudeCodeDriver`
library default is unchanged (still `acceptEdits`); only the CLI opts up.

Closes #225.
