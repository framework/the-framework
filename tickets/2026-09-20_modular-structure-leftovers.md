Topics: [the-framework, modularity]
GitHub: [#1818](https://github.com/framework/the-framework/issues/1818)

# Modular structure: what the four module PRs left behind

## TLDR

After the four module pull requests — #1812 (logs), #1813 (queue), #1815 (tickets), #1817 (branches) — the dashboard reads every skill through the command its package declares and imports none of them. This ticket collects, in one list, the features those pull requests dropped and the work they left for later.

Suleiman's picks so far: the Overview cards belong to the package that provides them; the onboarding steps stay the framework's; Discord as a module is a later thought.

## Scope: the work stops after two pull requests

The plan's five pull requests are cut to two.

- Pull request 1, the root build: #1822.
- Pull request 2, the name the agent gave its work, answered by the branches package and drawn by the framework: #1823. The framework strips no prefix; no `publish --base`.
- Pull request 3, the Overview-card slot, is built and held on a branch, not opened.
- Pull request 4, the two cards moving into the packages, and the launcher's gear options: not built.
- Pull request 5, the housekeeping, is folded into whatever comes next.

Why: the dashboard is secondary for now, and losing a feature in the refactor is acceptable. The direction is a handful of polished skills, then a drastically simpler dashboard. Restoring cards and options runs against that.

Still true from the plan: the clean rule stays the package's; a plan ask may be queued twice; "Plan truncated" does not come back; AGENTS.md's `FEATURES-SPEC.md` rule still needs to go.

## Why it matters

The four pull requests landed the modular structure but each left a small debt. Collected in one place, the next round picks from one list instead of rediscovering the gaps.

## Features the module pull requests lost

From #1817 (branches):
- The session name. Labels and pull request titles show the branch as the agent named it (`agent-fix-login`, not `fix-login`). The prompt comes first, so it shows only for a run without one.
- Open PR on a stopped run whose checkout holds uncommitted work used to push the commits anyway. The package refuses with its clean rule; the bar shows its line.
- The pull request base is gh's default branch; the framework no longer passes `--base`.
- A new run's checkout is seen within five seconds through the cache, except the dashboard's own Start and the run page's diary, which ask fresh.
- The scratch sweep may delete a branch a run named, once recorded, landed, without an open pull request, old and not busy. Before it considered only `agent-<timestamp>` names.

From #1815 (tickets):
- The page-wide "Add to queue: plans" no longer skips a plan ask when the ticket itself is queued for implementation: the queue cannot know a plan ask belongs to a ticket.
- The plan page's "Plan truncated" note: the plan comes whole from `tickets show`.

From #1813 (queue): nothing lost. The Docs panel's queue tab moved to the `/queue` page.

From #1812 (logs): nothing lost.

## What #1798 (the launcher) removed on purpose, and has not come back

#1798 made the launcher start a run through the project's own start hook and deleted the daemon's runner with everything that lived only for it (Suleiman's pick: deleted, not kept dark; the way back is written down). The launcher's gear button was that menu, and its rows were the runner's settings. The last commit with every file is 43c4de5b^ (`git show 43c4de5b^:packages/framework/<path>`).

Gone from the launcher:
- The options gear (`OptionsMenu.tsx`, `agent-option-rows.ts`) with its rows: Transparent, Disable system prompt, Push branch / Open PR / Auto-merge when the agent finishes, Browser, and "Run on" (this machine, a device, Claude web, GitHub Actions, "Add a device…").
- The "In play" strip and the system-prompt disclosure.
- The built-in presets menu (project presets stay: `PresetCreatePanel.tsx`).
- The `<` tags and `showChoices()` tokens of the prompt editor.
- The live handoff checkboxes on a run and "Merge when finished".
- The browser tab and panel on a run (`BrowserPanel.tsx`, `InlineBrowser.tsx`, the daemon's stream proxy) and the web-run driver (`src/driver/cloud.ts`); their return is planned as options of the run tool plus a run widget (#1819).
- The Settings rows of the removed preferences; `sendSetHandoff` and `sendPushBranch`.

Came back since: the Context picker and `@`/`#` context (#1806); the post-merge cleanup box (#1810). Merge and Open PR on a finished run never left.

What each of the rest needs to return: a home in the run tool (`agent-scheduler run` flags, or agent-driver for the drivers) and, for the ones with a screen, a run-page slot or a widget, since the dashboard names no tool.

## The Overview cards belong to their package

Today the Overview always draws the AI Queue card and the hot tickets card, whatever packages the project has; without the queue package the card still says "Nothing queued". Both are the framework's, fed by the providers.

- The AI Queue card moves into the queue package. Its start and fan-out buttons need the launcher, a host service.
- The hot tickets card moves into the tickets package, with its two ticket lanes (in progress, through the host's `agents` service; high priority). Its rows are links, so the existing link-actions slot lets the queue package attach "Add to queue" to them, as on the ticket page. The card's "AI Queue" lane goes: the AI Queue card sits beside it and is the queue's.
- The Human Queue and Agents cards stay the framework's: they compose pull requests, waiting runs and live runs, not one package's data.
- Needs the Overview-card slot: a package's widget declares a card, the Overview draws the cards the installed packages declare, in a fixed order.

Tickets and the queue stay independent, as their DECISIONS say: tickets work without the queue (only the "Add to queue" button is absent), the queue works without tickets (an entry is a line, a ticket link is just a link).

## Onboarding steps stay the framework's

Shown or hidden by whether a project has the package, as today. A slot for a package to bring its own step: maybe later.

## Slots deferred until a package needs them

- Run-page controls: the Open PR / Merge PR / Remove worktree buttons are the framework's, calling the branches provider. A package cannot add a button to a run.
- The tickets page's bulk buttons are phrased by the framework with the action's label.
- The onboarding's "Update from GitHub" button names the `update-tickets` command.

## Discord as a module

The last piece of "everything a module". Today the daemon's watcher posts the Human Queue to a webhook, with its own credentials store, preference and onboarding step. As a package it would take from the framework instead of providing to it: the items that need a person, handed to a command the package declares. Later.

## Housekeeping

- One root build of everything the daemon runs. `pnpm build` builds only the framework; each package needs its own build at every cutover, and #1817's CI failed on a build one package got for free from another.
- The skill copies under `.claude/skills` drift from the packages' SKILL.md (noted at the #1800 review).
- The Logs page re-reads once a minute; the logs widget takes the dashboard's theme file by a repository-relative path when it builds.
- `lib/preferences.ts` parses the page URL itself.
- The Human Queue's unpushed rows read only recorded runs.
- `FEATURES-SPEC.md` does not exist on main, while AGENTS.md says every feature is listed there.

## The handoff flow

The run page's Open PR → Merge PR → Remove worktree flow works but is not the right flow yet; what to change comes later.

## See also

#1819 (the agent's browser as a package), #1820 (no forge, other forges).
