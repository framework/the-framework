What the framework knows about each driver it can run — a whole coding-agent CLI the user already pays for, driven on their own subscription with no API key — and the one place an agent turns the picked driver into a live implementation.

## TLDR

- Each agent declares its binary, an install hint, how to ask it "am I logged in?", and the one command that fixes a no — so a dead setup is caught before any quota is spent.
- Only a clear "logged out" fails the preflight check; an answer that cannot be read counts as unknown, because wrongly blocking a working setup is worse than the silent dead agent this exists to prevent.

## Before modifying/creating SPEC.md files

Always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
