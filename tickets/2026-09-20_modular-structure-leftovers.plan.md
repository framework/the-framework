Effort: 3
Uncertainty: 2

# [Plan] Modular structure: what the four module PRs left behind

What is still open from the ticket's list, checked against main at 1d324acb, and the one pull request that closes it.

## TLDR

Most of the list has shipped. The root build (#1822), the name the agent gave its work (#1823), the Overview-card slot (#1825), the two cards moving into their packages (#1826), and the git host as a declared command (#1827, #1829) are all merged. The sweep test for a branch a run named itself exists (`cloud-scratch-refs.test.ts`, "a branch a run named itself still has to clear every gate"). The skill copies under `.agents/skills` match their packages' `SKILL.md` today (#1838 re-synced the last one).

What is left is housekeeping: five small changes, one pull request. Everything else in the ticket belongs to another ticket or is an accepted loss.

## Still open

Each checked on main.

1. **AGENTS.md still says every feature is listed in `FEATURES-SPEC.md`**, and no such file exists.
2. **The skill copies can still drift.** `.agents/skills/<name>/SKILL.md` are plain files that match their packages only because someone copied them. Only `branches` is a link, and that link is written by `skill-branches/src/skill-links.ts` into a run's checkout; it is not tracked.
3. **`dashboard/lib/preferences.ts` parses `window.location.pathname` itself**, in four places (lines 97, 127, 179, 184).
4. **The Human Queue's unpushed rows read only recorded runs.** `unpushedFor` (`src/dashboard/interventions.ts:183`) starts from `listAgents`, so a checkout with commits whose run left no record shows nothing.
5. **Three widget stylesheets import the dashboard's theme by a repository-relative path**: `@import '../../framework/dashboard/widget/theme.css'` in `skill-logs`, `skill-tickets` and `skill-queue`'s `dashboard/dashboard.css`. A package built outside this repository cannot find it.

## Decisions

- **`FEATURES-SPEC.md`: the rule goes.** Every feature is described in the LOGIC.md of the code that implements it, and those files are kept. A second hand-kept list would be one more place to forget. Remove the line from AGENTS.md.
- **The skill copies become symlinks to the package's file**: `.agents/skills/<name>/SKILL.md -> ../../../packages/skill-<name>/SKILL.md`, committed. Then there is one text and nothing to drift. `logic-driven-development` has no package and stays a file. Rejected: a CI check that compares the copies. It catches drift after the fact; a link makes drift impossible.
- **The theme comes through the framework's exports.** The framework exports `./widget/theme.css`. Each of the three packages gets `framework` as a workspace dev dependency and imports `framework/widget/theme.css`. The widget types are already published this way.
- **The unpushed rows also read the provider's checkouts.** Also take the branches the provider's `list` answers, deduplicated by branch. A checkout with no record gets a row named after its branch.
- **`preferences.ts` takes the project from one helper.** Replace the four `parseRoute(window.location.pathname)` calls with one function. Where a hook runs, use the router's current project. `updatePreferences` runs in an event handler, and its comment explains why it reads the location there; it keeps doing so, through the same helper.

## Not in this plan

- **Handed to other tickets.** The launcher's removed options, the run's browser and the web-run driver go to #1819. Discord as a module comes after that.
- **Later, per the ticket.** The run page's Open PR → Merge PR → Remove worktree flow, the deferred slots (run-page buttons, the tickets page's bulk buttons, the onboarding's "Update from GitHub"), and the onboarding step slot.
- **Accepted losses, not bugs.** A plan ask may be queued twice. "Plan truncated" does not come back. The pull request base is the git host's default. Open PR refuses a stopped run whose checkout is dirty: the branches package's clean rule stands. The five-second checkout cache stays. So does the Logs page's once-a-minute re-read.

## Implementation

One pull request:

1. AGENTS.md: remove the `FEATURES-SPEC.md` line.
2. `.agents/skills/*/SKILL.md` → relative symlinks to `packages/skill-*/SKILL.md`, every skill that has a package. Check that `.claude/skills/<name>` still resolves through them, and that Claude Code loads a skill through a symlinked file.
3. `packages/framework/package.json`: export `./widget/theme.css`. Make sure the build copies it into what is exported. The three widget packages: add the dev dependency, change the `@import`, rebuild, and check that the pages still take the theme's colours.
4. `src/dashboard/interventions.ts`: add the provider's checkouts to `unpushedFor`. Add a test for a checkout with commits and no record, and update `interventions.LOGIC.md`.
5. `dashboard/lib/preferences.ts`: one helper for the current project. Update its LOGIC.md.

Run `pnpm build`, `pnpm typecheck` and `pnpm test` at the root. Once it merges, the ticket closes: everything else it lists is merged, handed over, or accepted.
