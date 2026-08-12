The failure cases of computer-use: an unsupported model at setup, and an agent run exceeding its action cap.

## TLDR

- Computer-use works only with Anthropic-family models (direct or via Bedrock), so the tool refuses anything else at setup — before the model gets a chance to request actions nobody can execute.
- Claude routed through OpenRouter doesn't count, because those requests never reach Anthropic's native computer-use interface.
- The action-cap error stops a runaway agent that keeps clicking the same broken button forever.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
