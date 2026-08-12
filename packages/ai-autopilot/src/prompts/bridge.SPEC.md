Turns prompt data into something the loop can actually run: each pass gets a freshly built agent, briefed with what was already decided, and pointed at the change that happened.

## TLDR

- The instructions handed to the agent are the decisions briefing (ideas already considered and rejected) followed by the prompt body, so a check never re-pitches what was turned down.
- The change event is rendered into plain task text: what kind of change, a summary, the files touched.
- A fresh agent per pass is deliberate — re-examining with no carried-over context is the point of running multiple passes.
- How the agent is built (model, tools) is injected by the caller, and a whole library can be materialized at once so the default policy's ids resolve to runnable checks.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
