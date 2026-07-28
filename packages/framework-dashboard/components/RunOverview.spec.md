The run overview cards (#431) — the "moat" the wrapped agent's own chat cannot show: status line, loop verdict, deploy plan and session link, each a pure projection of the event stream.

## TLDR

- Folds events via `@gemstack/the-framework/client` projections: `loopStatus`, `sessionInfo`, `deployPlan`, `runProgress`, plus `runStatusPill`; cards render only when their data has arrived, so an early run shows nothing extra (returns null when all are absent).
- `showName`/`showStatus`/`showLoop`/`showSessionLink` opt-outs exist because the run's own view (RunView) relocates each: name/status into the action bar, the loop verdict into the right rail; the relay watch and project home keep them, having no bar/rail.
- The session link is labeled honestly via `describeSessionLink`: a headless Claude Code run has no per-session URL, so the generic claude.ai/code entry reads "Open Claude Code" with the id surfaced separately — never a fake deep link.
