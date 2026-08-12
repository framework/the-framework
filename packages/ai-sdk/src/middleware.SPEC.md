Runs the middleware hooks around an agent step, each in its proper composition style.

## TLDR

- Configuration changes pipe through: each middleware sees the previous one's result.
- Stream chunks pipe too, and any middleware can drop a chunk entirely.
- For pre-tool-call vetoes, the first middleware to give a decisive answer wins; all remaining hooks (start, iteration, after-tool-call, finish, usage, abort, error) simply run in order.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
