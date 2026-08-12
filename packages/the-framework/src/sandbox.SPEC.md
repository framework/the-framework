Copies a workspace's source files into a fresh sandbox container so the serve check can boot the agent's app in isolation.

## TLDR

- Text sources only, kept deliberately cheap: build output, caches, version control, oversized files, and binaries are all skipped, and the sandbox reinstalls dependencies itself from the seeded manifest.
- A seed for proving the app boots, not a faithful mirror of the workspace.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
