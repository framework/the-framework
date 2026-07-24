---
"@gemstack/the-framework": patch
---

Add a "Suggest new features" preset.

The Agentic-PM presets covered proposing work items you describe (Suggest new tickets), researching the outside market (Market research), and choosing among tickets that already exist (Suggest tickets to work on) — but not proposing net-new features from the product itself. This fills that corner: it studies what the product does today and proposes features it should have next, writing each as a ticket under `tickets/` for the normal triage pipeline to pick up.

Autonomous rather than gated, like the other suggest-class presets: a proposal is a reviewable ticket, so the human triages later instead of approving mid-run, which also keeps it usable on a schedule. Paramless — it scopes itself to the whole product, so there is no blank to fill.
