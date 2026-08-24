# Prompts

Every prompt the framework sends an agent lives here as markdown (#551). Nothing agent-facing
is written in TypeScript any more, so prompting can change without touching the code.

| file | what it is |
|---|---|
| `system_prompt.md` | The built-in system prompt (#326). Rom's doc. |
| `build_prompt.md` / `extend_prompt.md` / `scaffold_prompt.md` | The prompts a build session opens with (#1347): greenfield, existing codebase (#185), and the scaffold retry (#182). `${{ tf.prompt }}` is the user's intent. |
| `protocols/await.md` | How to emit an awaited choice so the turn-boundary gate can detect it (#337/#339). |
| `protocols/signal.md` | How to emit `setSessionName()` / `setReadyForMerge()` (#326). |
| `presets/*.md` | One file per preset button: research (#331), readability (#360), maintainability (#361), security_audit (#461), ux (#472). |

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
