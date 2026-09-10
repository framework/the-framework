Names the six presets that materialize to disk and where they live, touching nothing on the machine so the dashboard can use it in the browser: the file stems `maintainability`, `readability`, `security_audit`, `research`, `ux` and `maintenance`; the directory `.the-framework/presets/` relative to a checkout [1]; the path `.the-framework/presets/<stem>.md` of each preset, which is what a queue entry [2] names and what a prompt reads as that preset's file path; and the map from every stem to its path that every preset renders against. The stem is the underscore file name, never the hyphenated preset name (`security_audit`, not `security-audit`). Paths are relative to the checkout because the checkout is the agent's [3] working directory. The prompts themselves stay in the catalog (`preset-catalog.ts`), and `presets.ts` joins the two on the daemon's side.

## Glossary

[1] checkout: An agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[2] queue entry: An item on the agent queue, `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.
[3] agent: The unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
