---
"@gemstack/ai-autopilot": minor
---

Add the runner seam: a pluggable `Runner` execution environment (workspace filesystem + shell + optional preview URL), shaped after Flue's `sandbox` contract so WebContainer, Docker, and Flue sandboxes drop in behind one interface. Ships the interface plus `FakeRunner` (the runner analog of `ai-sdk`'s `AiFake`) for infra-free testing, and `runnerTools(session)` to expose a booted session to an agent as sandbox tools (`read_file`, `write_file`, `list_files`, `exec`, `preview`). Real adapters (FlueRunner, WebContainer, Docker) land separately. Interface-first slice of the runner child (#99) of the ai-autopilot epic (#97).
