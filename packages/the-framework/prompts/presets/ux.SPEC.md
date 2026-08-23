The UX preset: reviews every UI flow of whatever the user named — the launcher asks "what to review the UX of" — rates each one, then fixes the ones that rated badly. It ends in work rather than in a question, so an agent started from it finishes on its own.

## Business logic — TL;DR

- **Enumerate before rating** - the agent lists *all* UI flows first, with no flow skipped.
- **Every flow gets a rating and a reason** - from 10, a perfect user experience, down to 0, unusable.
- **Only the bad ones are changed** - the flows with a bad rating are improved, each in its own commit.
- **The bar is explicit, and so is the anti-laziness check** - the agent works until the result is exceptionally good, and is told that mostly-perfect ratings read as not having looked.
- **Report the before and after** - the flow list is printed again with old rating against new rating and links to the commits.

## Business logic

### Enumerate, rate, then fix

#### User story

The user wants the whole product's user experience judged, not the parts an agent happened to open — and wants the judgement visible, so they can disagree with a rating rather than only with a diff.

#### Business logic

The agent's first act is to enumerate all UI flows of the named target, with 100% coverage demanded explicitly. It then rates each flow from 0 (unusable) to 10 (perfect) and gives a reason for every rating. Only then does it improve the flows that rated badly, one commit per flow improved.

The pass ends with a summary: the flow list printed again, each entry showing its old rating against its new rating, with links to the commits.

### The bar is explicit, and so is the anti-laziness check

#### User story

The user does not want to prompt again and again for quality.

#### Business logic

The agent is told to work until the result is exceptionally good and that an expert team will check every detail. It is also told how its own ratings will be read: mostly-perfect ratings are taken as a sign it has been lazy, so it is to scrutinize everything and spend substantial time, striving for quality autonomously rather than being pushed.

#### Rationale

The preset is unattended by design — it never stops to ask — so the quality bar has to be carried by the prompt itself rather than by someone reviewing mid-run.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
