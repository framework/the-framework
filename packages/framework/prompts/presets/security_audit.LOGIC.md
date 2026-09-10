The "Security audit" preset of the launcher: the agent [1] scrutinizes the whole of the target for potential security issues, exhaustively, and fixes each issue it finds in a commit of its own. The target is the preset's one parameter, "What to security-audit", filled by the rule in `src/preset-prompt.ts`; left blank, it is the session the preset was launched from, or the "entire codebase" when there is none. The same prompt is also written to a project as `.the-framework/presets/security_audit.md`, which is how the follow-up in `on_before_mergeable_prompt.md` and the "Maintenance" preset queue a security audit of a given scope for a later agent to work.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.

## Business logic — TL;DR

- **Exhaustive** - the agent scrutinizes the entire code of the target for potential security issues, with full coverage, never a sample.
- **Every aspect gets a verdict** - it lists every aspect it considered, each with a verdict, and explains the verdict whenever it is not obvious, so a clean verdict is as reviewable as a finding.
- **One commit per fix** - every security issue found is fixed in a separate commit.
