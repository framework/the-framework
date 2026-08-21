What the framework knows about each driver it can run — a whole coding-agent CLI the user already pays for, driven on their own subscription with no API key — and the one place an agent turns the picked driver into a live implementation.

## User Stories

- The user picks which coding-agent CLI does the work, and it runs on the subscription they already pay for — no API key.
- The user with a dead setup — the driver not installed, or logged out — is told before any quota is spent, with the fix named.

## Flows

- Each driver declares its binary, an install hint, how to ask it "am I logged in?", and the one command that fixes a no — so a dead setup is caught before any quota is spent.
- Only a clear "logged out" fails the preflight check; an answer that cannot be read counts as unknown.

## Rationales

- An unreadable login answer counts as unknown, not as logged out, because wrongly blocking a working setup is worse than the silent dead agent the check exists to prevent.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
