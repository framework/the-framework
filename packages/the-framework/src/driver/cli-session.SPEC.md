The one way any driver CLI is run: spawn it over the workspace, hand it the prompt, stream its output through that CLI's own dialect parser, and settle the turn on how the process ended.

## TLDR

- A turn fails on an abnormal exit even when the agent streamed plausible text first — the product gates on outcomes, and a crash mid-work must not pass as a result; what the agent said on the way down becomes the error detail.
- Stopping a turn kills the agent's entire process tree: asked nicely first, forced after a grace period.
- The prompt travels over the agent's input stream, so its length is unlimited and none of it can be misread as a command; an agent that dies before reading it fails the turn cleanly instead of crashing the product.
- Only the parser knows which CLI is on the other end, so a second driver gets all of this for free.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
