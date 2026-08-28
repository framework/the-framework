What the tests cover: driving the Codex CLI and translating a real Codex turn into the driver event stream.

- Codex narrates as it works: every message it makes is streamed as it arrives, and the last one is the turn's answer. Tool use surfaces as its kind only, never its arguments. Output that is not one of the CLI's structured events is ignored.
- The turn's usage carries token counts and no cost at all, since Codex prices nothing and a cost of zero would read as "free".
- Token counting is exact: the reported input total already includes everything served from cache, so the genuinely new input is the difference; reasoning tokens are part of the reported output rather than additional to it, so they are never counted twice; no cache-creation count is invented. A missing or nonsensical accounting yields no usage rather than a wrong one, and a cache figure larger than the input total can never produce a negative count.
- The CLI runs sandboxed to the agent's own checkout — never with the flag that disables the sandbox — and is told to run even when the checkout is not a git repository.
- The prompt goes in through the CLI's input rather than as a command-line argument, so a long one is never truncated, and the system prompt framing is prepended to it since Codex has no separate channel for it. The chosen model is passed through.
- This driver reports no quota at all, which means a caller's spending limits simply do not apply to a Codex agent rather than being applied to a made-up figure.
- A turn whose CLI exits with a failure is reported as failed, even though the agent streamed text first.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
