Fluent image generation — describe the picture, optionally tune size, quality, style, and count, then generate.

## TLDR

- Uses the default model unless one is chosen; alternate models can be declared as failover and are tried in order until one succeeds.
- A generated image can be persisted in one step through caller-supplied storage, whether the provider returned the image data itself or a link to it.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
