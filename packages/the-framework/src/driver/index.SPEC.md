The drivers' public doorway: one import for the driver contract, every driver (Claude Code, Codex, GitHub Actions, cloud, fake), and the quota reader — what a driver needs internally does not pass through here.

## Rationales

- The package's root export re-exports this doorway wholesale, so anything listed here is published, and an accidental export is a one-way door once released.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
