The suggest-new-features preset: the agent studies what the product does today and proposes net-new features as tickets, then shows a summary of what it proposed without stopping.

## Business logic — TL;DR

- **Read the product first** - the agent skims the README, the docs and the main user-facing surfaces, plus the existing tickets, before proposing anything.
- **Net-new capabilities only** - features a user would want, not bugs, refactors or chores.
- **No duplicates** - anything an existing ticket already covers, or that is already built, is skipped.
- **Worth building, and in the product's direction** - proposals are favoured on those two grounds.
- **Proposals become tickets** - each one is written as a new ticket under `tickets/`, following the ticket format, and the agent ends by showing a short summary.

## Business logic

### Propose, do not decide

#### User story

The user wants a product manager's view of what to build next, but keeps the decision: a proposal that arrives as a reviewable ticket can be triaged later, rather than needing the user to approve it while the agent waits.

#### Business logic

The agent's whole output is tickets plus a non-blocking summary shown to the user. It never stops to ask, which is what makes the preset usable when nobody is around, and the review happens later when the tickets are triaged.

### Read the product first

#### User story

Proposals only land if they fit what the product already is and do not repeat what is already planned or already built.

#### Business logic

Before proposing, the agent studies what the product does today — the README, the docs, the main user-facing surfaces — and the existing tickets. That reading sets both filters: it skips what an existing ticket covers and what is already built, and it favours features that fit the product's direction and are worth building. What it proposes is net-new capabilities a user would want, explicitly not bugs, refactors or chores.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
