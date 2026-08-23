Asks Claude Code where the account's subscription quota stands, and turns its answer into the reading the daemon uses to decide whether unattended work may keep spending.

## User story

The user's coding-agent subscription is a fixed weekly allowance. The Framework spends it on the user's behalf while nobody is watching, so it has to know how much is left — and it must never spend the week dry because it guessed wrong.

## Glossary

- **quota window** - one line of the CLI's usage readout: a named allowance with a percentage used and, usually, when it resets. There are three kinds — the current session, the current week across all models, and the current week for one specific model.

## Business logic — TL;DR

- **The CLI answers for itself** - the reading comes from Claude Code's own usage command, run non-interactively; The Framework never talks to Anthropic and never touches the user's credentials.
- **Reading the quota costs nothing** - the command is answered locally by the CLI, spending no tokens and no turns of the user's allowance.
- **A failed read is never a zero** - an unreadable answer is reported as unreadable, never as "nothing used".
- **"No subscription" and "could not read it" are different answers** - an account with no subscription quota at all is distinguished from a subscription whose readout The Framework failed to understand.
- **The read always ends** - a missing CLI, a failing CLI, a hung CLI, or the user cancelling each produce their own distinct outcome rather than leaving the caller waiting.

## Business logic

### The CLI answers for itself

#### User story

See `## User story`.

#### Business logic

The reading is obtained by running the Claude Code CLI's own usage command in non-interactive mode and reading what it prints. The CLI reaches Anthropic with its own stored credentials, so The Framework never reads, stores, or forwards the user's token. The command must be run in the CLI's normal subscription mode; running it in the mode that forces API-key authentication would make the subscription quota disappear entirely.

The command spends nothing — no tokens, no turns, no cost — because the CLI answers it locally instead of prompting a model.

### A failed read is never a zero

#### User story

Unattended work stands down once the quota boundary is reached. A reading of "0% used" would tell the daemon it has the whole week to spend.

#### Business logic

The answer is prose, so reading it is a text parse and a reworded readout is a real failure mode. Every quota window found in the readout is reported with its label, its kind, its percentage used, and when it resets. If no quota window is found at all, the outcome is an explicit "no reading", never an empty or zero reading.

#### Rationale

The same readout contains other lines that resemble a quota window closely enough to fool a loose reading — a list of top skills with percentages, a note about what share of usage was at long context. Only lines stating a percentage used directly after their label are taken.

### "No subscription" and "could not read it" are different answers

#### User story

An account authenticating with an API key has no subscription quota to report, and that is normal. An account on a subscription whose readout could not be understood is a defect that has to surface as one.

#### Business logic

When no quota window could be read, the readout is checked for the phrase Claude Code prints above any subscription's figures — the same phrase whether the account is inside its allowance or already running on overage. If that phrase is present, the account does have a quota and the reading is reported as unrecognized. If it is absent, the account genuinely has no subscription quota, and that is reported instead.

#### Rationale

Keying on the word "subscription" alone would misread an account currently on overage — which still has a quota worth reporting — as having none.

### The read always ends

#### User story

See `## User story`.

#### Business logic

Each read has its own distinct outcome: the CLI not being installed, the CLI exiting with a failure or reporting its own upstream failure, output that cannot be understood, the user cancelling, and the read taking too long (twenty seconds by default). None of these leaves the caller waiting, and none of them is reported as a successful reading.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
