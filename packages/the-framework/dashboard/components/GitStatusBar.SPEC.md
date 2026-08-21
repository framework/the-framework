The checkout-in-play status line — active branch, a clean/dirty dot, the linked PR — shared by the project home and the agent page, so the same facts cannot drift into two looks.

## Flows

- On an agent it reports that agent's own checkout, adding what only an agent's checkout carries: its size on disk, and honesty that uncommitted changes there are the agent's, not the user's.
- Refreshed on a slow cadence, but sped up while a PR lookup is still settling, so that answer appears in seconds rather than after a full cycle. Nothing renders when there is no checkout to report.
- The agent's name leads and truncates last — it is the stable identity, where the branch gets renamed by the agent — and other facts drop out whole as the bar narrows rather than squeezing.
- It can double as the disclosure for the branch detail below it, so an agent's branch is spoken about in exactly one place.

## Rationales

- Clean is deliberately neutral, not green: green means "changed/added" one pane away, and a clean tree has nothing to announce.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
