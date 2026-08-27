# Prompts

Every prompt the framework sends an agent lives here as markdown (#551). Nothing agent-facing
is written in TypeScript any more, so prompting can change without touching the code.

| file | what it is |
|---|---|
| `system_prompt.md` | The built-in system prompt (#326). Rom's doc. Its `# User prompt` slot is where the user's own text is rendered, for a build and a prompt session alike (#1691). |
| `ticketing_format.md` | The ticket file format: how a ticket, its plan and its lock are written under `tickets/`. Travels in every agent's context. |
| `todo_format.md` | The agent-queue format: how `TODO_AGENTS.md` is banded by priority. Travels in every agent's context. |
| `data_branch_protocol.md` | The data-branch protocol: tickets, the queue and the session archives live on `tf-data`, read and written there directly, never on a code branch. Travels in every agent's context. |
| `branch_yourself.md` | The "Branch management" section for an agent that runs outside a checkout The Framework created (#1725): the command is not there, so it branches with git itself. Agents in their own checkout get the branch-management package's `SKILL.md` instead. |
| `triage_scope.md` | The queue-only rule appended to both triage presets: a triage writes `TODO_AGENTS.md`, never a ticket's code (#1641). |
| `on_before_mergeable_prompt.md` | The optional extra turn an agent gets when it signals ready for merge: queue quality follow-ups, fold what it learned into the knowledge base. |
| `protocols/await.md` | How to emit an awaited choice so the turn-boundary gate can detect it (#337/#339). |
| `protocols/signal.md` | How to emit `setReadyForMerge()`, the pull request to open, and an error only the user can fix (#326). |
| `protocols/browser.md` | Added only when the run has a real Chrome attached: the `chrome-devtools` tools and what the agent may do with them (#793). |
| `protocols/hands_off.md` | Added only when the session runs detached (a web run): land everything, since nothing on a machine follows it. |
| `presets/*.md` | One file per preset; `src/preset-catalog.ts` is the table saying which button or routine each backs. Launcher buttons: research (#331), readability (#360), maintainability (#361), security_audit (#461), ux (#472), maintenance (#881), market_research (#694), plan_tickets (#685), suggest_new_tickets (#462), suggest_new_features, suggest_tickets_to_work_on, drain_queue (#855). Routine prompts: update_tickets (#1208), triage_quick (#891), triage_consensual (#892). |

## Editing

Edit the markdown, then `pnpm build`. `scripts/gen-prompts.mjs` compiles this directory into
`src/prompts.generated.ts` (git-ignored, rebuilt by `build` / `test` / `typecheck`), which is
what the code imports. The markdown is the only source of truth.

Adding `foo/bar.md` exports `FOO_BAR`. A file's exact bytes become the string, minus one
trailing newline.

## Why generated instead of read from disk

`@gemstack/ai-autopilot` reads its `prompts/*.md` with `node:fs` at run time. That does not work
here: the system prompt and the presets are reachable from `src/client.ts`, which the dashboard
imports **in the browser** to show the user the prompt before a run (#520). A `node:fs` edge
there breaks the browser bundle, and `client.test.ts` fails the build over it. Generating a
module of plain strings crosses that boundary for free and keeps the package `files: ["dist"]`.

## Two rules

- **The system prompt is Rom's** (#500/#547). It is designed on #326; these files are the source of truth, and a change to them is reviewed in its PR like any other.
- **Prompts get a review round before they land in production** (#547). The point of this
  directory is that a prompt change is a readable markdown diff.
