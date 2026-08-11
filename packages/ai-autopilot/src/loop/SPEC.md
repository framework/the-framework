The loop: after the agent does work it declares what kind of change it made, and the right follow-up prompts fire automatically — a major change gets review, code quality, and security; a new user-facing flow gets QA and UX.

## TLDR

- This is the web-app-specific orchestration generic coding harnesses lack: semantic, not command-driven — a kind of change selects a set of prompts, instead of everything running on every change.
- A policy maps each change kind to an ordered chain of prompts, named by id only; the prompt bodies come from elsewhere, and a built-in policy covers the common web-app kinds.
- The engine runs each prompt several times with a fresh context per pass, because re-deriving the answer improves it.
- A chain is fire-and-report by default (every prompt runs, failures are collected) or a blocking gate (stop at the first prompt that does not pass).
- A prompt can end with a verdict — the blockers still to fix — so the gate stops on what a review concluded, not merely whether it ran; bootstrap's finishing loop repeats against it until the list is empty.
- Prompts can consult the ledger of past decisions so they do not re-propose what was already rejected.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
