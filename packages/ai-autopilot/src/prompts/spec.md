The prompt library and the bridge from a markdown prompt body to a runnable loop prompt.

## TLDR

- `library.ts` indexes prompt bundles (get/all/by-event); `parse.ts` turns a markdown file's frontmatter into a prompt (dispatch id, passes, event, title); `bridge.ts` composes the decisions briefing + body into instructions and renders the event as the task turn — **rebuilding the agent fresh on every pass** (the fresh-context contract is enforced here, since the engine cannot).
- The prompt body is the system prompt; the rendered event (change kind, summary, files touched) is the user turn.

## Facts

- The dispatch id is the frontmatter's loop id **falling back to the manifest name** — which is how the thorough-review body registers under the id the default loops reference, while the TLDR variant keeps its own id and is referenced by no built-in loop.
- By-event lookup filters on the prompt's own event metadata and is independent of the loops — a UI affordance, not a dispatch path.

## The built-in bodies (top-level `prompts/`)

- Nine bodies ship with the package: code-quality, knowledge-base, production-grade, qa, refactor, review-thorough (id `review`, two passes), review-tldr, security, ux. No spec.md may live in that directory — the loader parses every `.md` there as a prompt bundle and throws on a file without frontmatter.
- **A real gap to know about**: among the built-ins only `production-grade` emits a machine-readable `{ blockers }` verdict — the review/code-quality/security/ux bodies end in prose verdicts, so under the default parser their *findings* never fail a blocking gate (execution still gates). The verdict-emitting review prompts live in the domain presets.
- `knowledge-base.md` is explicitly not a task to run — standing business context to carry into other prompts; referenced by no loop. `production-grade.md` is stack-specific (Vike + universal-orm) and treats "unsure" as a blocker.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
