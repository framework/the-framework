The scripted scenario the fake driver plays: a small orders app built offline, with no coding-agent CLI and no model involved, so the whole product can be demonstrated and exercised deterministically.

## Business logic — TL;DR

- **One canned task** - the demo builds "a paginated orders page backed by an orders table, with sign-in", and by default finishes it in a single turn that reports having written the schema, the page and the sign-in stub.
- **Spend accumulates** - every scripted turn reports a small, plausible token and cost usage, so the dashboard's live spend readout has something to show.
- **Gates can be demonstrated offline** - setting `FRAMEWORK_FAKE_AWAIT` to `choices`, `multiselect` or `confirmation` makes the build stop and ask: a single-select decision between two auth approaches with one recommended, a multi-select checklist of problems to deep-dive with some pre-checked, or a plan approval that points at a plan document and whose Decline option stops the agent. In each variant the agent asks, the answer arrives, and the agent is re-prompted and finishes. These variants need the dashboard, since that is what answers a gate.
- **The fake session has a fixed name** - the demo always reports the same session id, so its links and records are reproducible.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
