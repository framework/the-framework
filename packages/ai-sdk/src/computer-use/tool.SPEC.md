Packages computer-use as an agent tool: the model requests screen actions, the tool runs them in the app's browser page and feeds the outcome back.

## TLDR

- The tool is tagged so the Anthropic adapter sends Claude its native computer-use tool instead of a generic function description — Claude is trained on the native form, and quality is dramatically better.
- Every action needs human approval by default; apps can opt out entirely or decide per action, e.g. waving screenshots through while gating destructive clicks.
- A per-run action cap bounds agents stuck retrying the same broken step forever.
- Screenshots go back to the model as images; failed actions surface as tool errors the model can react to.
- Told the agent's model up front, the tool refuses non-Anthropic models at setup rather than degrading silently.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
