Defines the options the user ticks for an agent [1] — one table of rows, with the rules between them already applied — so that the launcher's [2] options menu and the Settings page offer exactly the same options and cannot drift apart. Each row carries its label, a one-line summary, the long explanation shown on hover, whether it is ticked, whether it is inert and why, and what ticking or unticking it writes into the user's preferences [3]. A second, smaller list holds the options a finished agent's composer [4] offers when the user continues it with another message.

## Context

**User story**: before starting an agent, the user opens the options menu and sees which of them are on. Some rows only mean something in combination: asking for the browser under Codex would do nothing, and asking for a pull request without pushing the branch is impossible. Rather than letting the user tick a box the agent will ignore, such a row is shown grayed with the reason written under its label.

**Business logic story**: what a row shows is the *effective* value, not the stored one. An option that a higher-level switch overrides reads as off, because that is what the agent will do. A surface rendering this table can therefore never claim an option is on while the agent ignores it.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] the launcher: the Start form on a project's own page.
[3] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[4] composer: a project's prompt editor, also used for live chat.
[5] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).
[6] coding agent: the CLI doing the actual work: Claude Code or Codex.
[7] the built-in system prompt: the standing instructions every agent starts with.
[8] vanilla: an agent started without the built-in system prompt but with the signal protocols kept.
[9] ready for merge: the signal an agent emits when it believes its work is complete: it flips the agent's badge from building to ready and authorizes the handoff.
[10] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later. The user's driver choice is `claude` or `codex`.
[11] transparent: an agent started with nothing of The Framework's — the raw coding agent.
[12] routine: a preset the daemon fires on its own on a schedule.

## Business logic — TL;DR

- **The rows** - seven options in one order: "Transparent", "Disable system prompt", "Post-merge cleanup", "Push branch", "Open PR", "Auto-merge", "Browser".
- **"Transparent" overrides the options it does not apply to** - with it on, "Disable system prompt", "Post-merge cleanup" and "Browser" read as off and are grayed with "off while Transparent is on".
- **The publish ladder is three rungs over one setting** - the three publish rows are views of a single handoff [5] level, so ticking one raises the ladder to that rung and unticking one lowers it to the rung below.
- **A rung is inert while the rung below it is off** - "Open PR" is grayed with "nothing to open while Push branch is off", "Auto-merge" with "nothing to merge while Open PR is off".
- **"Browser" only on Claude Code** - under Codex it is grayed with "only on Claude Code — the browser is wired through its MCP config".
- **The options a Resume offers** - a finished agent's composer shows only the three publish rungs and "Browser", with the same rules applied.

## Business logic

### The rows

#### Context

See `## Context`.

#### Business logic

The table holds these rows, in this order, each with a label, a one-line summary under it and a longer explanation on hover:

- **"Transparent"** — its summary reads "Raw Claude Code — turns the whole framework off.", naming whichever coding agent [6] the user has selected, so under Codex the row does not promise raw Claude Code. It runs the coding agent exactly as the user would run it themselves: no built-in system prompt [7], no controls, no dashboard, no guard, no backlog loop. Off unless the user turned it on.
- **"Disable system prompt"** — "Drops the added system prompt; keeps the agent controls." Removes the built-in system prompt [7] while keeping The Framework's own controls, which is what makes the agent vanilla [8]. The explanation points the user at "Transparent" for a fully raw agent. Off unless the user turned it on.
- **"Post-merge cleanup"** — "Runs quality passes once it is ready to merge." When the agent [1] signals ready for merge [9], maintainability, readability and security-audit passes run. Off unless the user turned it on.
- **"Push branch"** — "Pushes the agent branch when it finishes." The bottom rung of the publish ladder: with it off the agent publishes nothing and neither the pull request nor the merge can run.
- **"Open PR"** — "Opens a draft pull request when it finishes." Pushes the branch on the way. The pull request is a draft, so it does not request a review, and it still shows on the list of things needing the user.
- **"Auto-merge"** — "Merges the pull request once it is opened." GitHub's own auto-merge is used where the repository allows it, so the work lands when its checks pass; otherwise the pull request is merged directly.
- **"Browser"** — "Gives the agent a real browser to inspect pages." The agent can navigate pages, read the console and the network, inspect the page structure and take screenshots. Off unless the user turned it on.

Every row other than the three publish rungs writes its own single setting when ticked or unticked. Which coding agent [6] the row names is the user's driver [10] choice, and Claude Code when no valid choice is stored.

### "Transparent" overrides the options it does not apply to

#### Context

**Problem**: "Transparent" [11] turns everything of The Framework's off, so the options that only exist inside The Framework mean nothing while it is on. A ticked box that the agent [1] ignores is worse than no box.

#### Business logic

While "Transparent" is on, "Disable system prompt", "Post-merge cleanup" and "Browser" all read as unticked, whatever the user has stored for them, and each is grayed with the reason "off while Transparent is on" written under its label. The reason is written into the row rather than left to a hover explanation, because a grayed row cannot be hovered. The three publish rungs are not overridden: a transparent agent still publishes its work as the ladder says.

### The publish ladder is three rungs over one setting

#### Context

**Problem**: the three publish steps are nested stages of one pipeline — push the branch, open a pull request for it, merge that pull request. As three independent switches they would describe states no agent [1] can honor, such as a pull request for a branch the remote has never seen. Storing one ladder level instead makes those states unrepresentable, and makes "publish nothing" a state the user can actually reach from this menu.

#### Business logic

The three publish rows are three views of one stored handoff [5] level, whose rungs are `local`, `push`, `pr` and `merge`, each including the ones below it. A row is ticked when the stored level reaches its rung. Ticking a row raises the level to that row's rung; unticking a row lowers the level to the rung immediately below it:

- "Push branch" writes `push` when ticked and `local` when unticked.
- "Open PR" writes `pr` when ticked and `push` when unticked.
- "Auto-merge" writes `merge` when ticked and `pr` when unticked.

Unticking therefore never leaves a merge armed with no pull request under it. When the user has stored no level at all, it is `pr`: an agent left alone pushes its branch and opens a draft pull request. This table is where a new agent's ladder comes from; a running agent's own action bar can still change the ladder for that one agent, and the routines [12] that merge their own work say so for themselves instead of through "Auto-merge".

### A rung is inert while the rung below it is off

#### Context

See `## Context`.

#### Business logic

"Open PR" is grayed, with "nothing to open while Push branch is off" under its label, whenever the stored level does not reach `push`. "Auto-merge" is grayed, with "nothing to merge while Open PR is off", whenever the level does not reach `pr`. The gating is presentation only: what each row writes is its own rung, so the ladder can only ever be raised or lowered one rung at a time.

### "Browser" only on Claude Code

#### Context

**Problem**: the browser reaches the agent [1] through Claude Code's own configuration for external tool servers. Under any other coding agent [6] the box would be tickable and do nothing.

#### Business logic

"Browser" reads as on only when the user turned it on, "Transparent" [11] is off, and the selected driver [10] is `claude`. Under Codex it is grayed with the reason "only on Claude Code — the browser is wired through its MCP config"; under "Transparent" it is grayed with "off while Transparent is on", which takes precedence in the wording when both apply. A stored driver choice that names no coding agent The Framework can drive leaves the row grayed as well: the fallback to Claude Code applies only to the name written in the rows' text, never to this rule, so a browser is never offered to a coding agent that cannot be given one.

### The options a Resume offers

#### Context

**User story**: the user reopens a finished agent [1] and sends it one more message. The composer shows only the options that the continuation will actually arm, so nothing offered there is ignored.

#### Business logic

A finished agent's composer offers the same rows, with the same rules applied, filtered to the three publish rungs and "Browser". The options that shape the opening instructions — "Transparent", "Disable system prompt" and "Post-merge cleanup" — are left out, because the conversation being continued already carries its framing; so are the coding agent [6], the model and where the agent runs, which the conversation being continued pins. The rows offered here write the same preferences [3] the launcher's [2] options menu writes, and the continuation reads them when it starts, which is what makes showing them here truthful.
