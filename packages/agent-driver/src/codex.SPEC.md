The driver for Codex: wraps the `codex` CLI as a black box on the user's own ChatGPT subscription, drives one full turn per prompt, and turns what the CLI prints into the same event stream every other driver produces.

## User story

The user prefers Codex, or already pays for it. They pick it as their driver and everything else about The Framework — the dashboard, the gates, the queue, the pull requests — works exactly as it does with Claude Code.

## Business logic — TL;DR

- **The user's own subscription does the work** - the CLI is run non-interactively on the user's existing ChatGPT sign-in; The Framework never supplies an API key.
- **The agent may edit its workspace and nothing else** - the CLI runs under a sandbox limited to the checkout it was pointed at. The mode that disables the sandbox entirely is never used.
- **The framing rides in front of the task** - Codex has no separate channel for a system prompt, so The Framework's framing is prepended to the prompt as its own block. The same words reach the agent.
- **The last thing the agent says is the turn's answer** - Codex narrates as it works; each message is streamed as it arrives, and the final one is the turn's outcome.
- **Tool use surfaces as its kind, never its arguments** - what The Framework gates on is the code and the outcome, not the individual tool calls.
- **Tokens without a price** - Codex reports token counts but never a cost, so usage carries the counts and reports no cost at all rather than a cost of zero, which would read as "free".
- **No quota reporting** - a driver that cannot say where the account's subscription stands simply does not, and the rest of the product copes.

## Business logic

### Tokens without a price

#### User story

The dashboard shows what each agent spent, and a user can cap how much an agent may spend before it stops.

#### Business logic

The CLI's end-of-turn accounting yields token counts only. Those counts are reported as the turn's usage, and no cost is reported — never a cost of zero, which spending limits would read as "this turn was free". Since the spending cap is expressed as a price, it cannot apply to a Codex agent at all, and The Framework says so when it starts rather than leaving the user to assume the cap is protecting them.

#### Rationale

Three details shape how the counts are read, each verified against the CLI's actual output. The reported input count is the *total* input including everything served from cache, so the genuinely new input is the difference between the two — repeating one prompt held the total steady while the cached figure climbed, which a non-cached count could not do. Reasoning tokens are part of the reported output count rather than additional to it, so counting them again would double the turn's output. And no cache-creation count is reported at all, because this provider caches implicitly and bills nothing separate for it — reporting zero there is the honest answer rather than a guess.

### Running where the work is

#### User story

See `## User story`.

#### Business logic

The prompt is handed to the CLI through its input rather than as a command-line argument, so a long task description, plan, or pasted log is never truncated. The CLI is pointed at the agent's own checkout, and is told to run even when that checkout is not a git repository — a workspace may legitimately not be one yet, and the CLI would otherwise refuse to start. The chosen model, when there is one, is passed through.

Output that is not one of the CLI's structured events — banners and other noise — is ignored rather than shown as agent output.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
