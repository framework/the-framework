---
"@gemstack/framework": minor
---

Keep everything in a single `.the-framework/` directory (#313). The transient run state (`events.jsonl`, `run.json`, `runs/`, `control.jsonl`, `daemon.json`) now lives in `.the-framework/` alongside the committed project log `LOGS.md`, instead of a separate `.framework/` directory. `install` seeds a `.the-framework/.gitignore` that ignores everything except `LOGS.md`, so the run state stays transient and only the log is committed.
