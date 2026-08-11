Lets an agent drive a real browser the way a human would — look at the screen, click, type, scroll — for tasks no plain API covers.

The model asks for one screen action at a time; the SDK executes it in a browser page the app supplies and shows the model what happened, usually as a fresh screenshot. It is Anthropic-only for now: the whole design rides on Claude's native computer-use training, so the action vocabulary mirrors Anthropic's exactly and the agent tool makes sure Claude receives its native tool form rather than a generic one. Safety comes from two defaults — every action is approval-gated, and each run has an action cap against runaway loops. Failed actions are reported back to the model, which decides how to recover, instead of killing the run over one missed click. The app owns the browser's lifecycle; the SDK never launches or closes one.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
