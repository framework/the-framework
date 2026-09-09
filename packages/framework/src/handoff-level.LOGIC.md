Fixes the handoff [1] as one ladder of four rungs, `local` < `push` < `pr` < `merge`, where each rung includes every rung below it: `local` publishes nothing, `push` pushes the agent's [2] branch, `pr` also opens a pull request, and `merge` also merges it. The default when nobody has chosen is `pr`, so an agent left alone pushes its branch and opens a draft pull request instead of leaving work on a branch nobody is told about, while landing on the default branch has to be asked for. The dashboard, the preferences [3] and the repo file [4] all name the handoff by these rungs.

## Glossary

[1] handoff: What happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it). "Handoff level" is a rung of that ladder.
[2] agent: The unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] preferences: The user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[4] the repo file: `the-framework.yml` at a project's root: per-repo defaults that travel with the code.

## Business logic — TL;DR

- **One rung, four states** - the handoff is a single rung, never three separate switches, so an impossible combination such as "pull request without push" cannot be represented; whether a rung is reached is one comparison along the ladder, and only the four rung names are valid values.
- **The default is `pr`** - absent any choice the ladder sits at `pr`; merging is the one rung above it and must be asked for.
- **The ladder as three questions** - "is the push armed", "is the pull request armed" and "is the merge armed" are derived from the rung, so no two surfaces can disagree about them.
- **Checkboxes resolve downward** - a surface offering the three questions as separate checkboxes resolves to the highest rung whose own box and every box below it are ticked: no push means `local`, push without pull request means `push`, push and pull request means `pr`, all three means `merge`. "Pull request without push" therefore resolves to `local` instead of silently switching the push back on, which is what lets a launcher offer "publish nothing" and deliver it.
