Runs the tool phase of one agent step: decides each tool call's fate through a single chain of gates, executes what's allowed, and streams a deterministic call → progress → result sequence.

## TLDR

- Every call passes one gate chain — unknown tool, handoff, client tool, approval, middleware veto/rewrite, argument validation — so serial and parallel execution behave identically and a new gate is written once.
- An approval still pending or a middleware abort halts the whole phase; other outcomes (errors, rejections, skips) become results the model can see and the phase continues.
- Parallel mode gates everything in order first, runs the cleared executions concurrently, then replays their buffered output in call order — streamed output stays deterministic regardless of which tool finished first.
- A tool can itself pause the run (for browser-side tools or a nested approval); its own call stays unanswered until resume.
- The model sees each tool's narrowed text output; the UI and the step record keep the original structured result.

## Rationales

- The first handoff in a step wins; sibling calls get synthetic "skipped" results so the history stays replayable.
- Even an aborted call gets a result, because a provider would later reject a conversation containing an unanswered tool call.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
