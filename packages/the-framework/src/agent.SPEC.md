What the framework knows about each agent it can drive — a whole coding-agent CLI the user already pays for, driven on their own subscription with no API key — and the one place a run turns the picked agent into a live driver.

## TLDR

- Each agent declares its binary, an install hint, how to ask it "am I logged in?", and the one command that fixes a no — so a dead setup is caught before any quota is spent.
- Only a clear "logged out" fails the preflight check; an answer that cannot be read counts as unknown, because wrongly blocking a working setup is worse than the silent dead run this exists to prevent.
- An agent that does not price its turns (Codex) cannot be spend-capped, and the run says so instead of implying a guard that is not there.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
