Why a pull request that does not finish an issue must not carry a phrase GitHub reads as closing it, and how such a phrase is defused without changing what the sentence says or what the reader can click.

## User Stories

- The user merges a plan's pull request and the ticket it discusses stays open, even though the plan's own text — its title as much as its body — says the work will close it.
- The user follows the issue reference in that sentence, and finds it still links to the issue — and the issue still shows that the pull request mentioned it.

## Flows

- A closing phrase is one of GitHub's keywords — close, fix, resolve, and their plural and past forms — followed directly by an issue reference, in this repository or another.
- Defusing puts the words "the ticket" between the keyword and the reference. GitHub only obeys the keyword when the reference follows it directly, so the phrase loses its authority while the sentence still reads as the agent wrote it.
- The reference itself is never touched, so it stays a live link and the issue still records that the pull request mentioned it.
- A reference already inside backticks is left alone: it is a code sample, GitHub does not act on it, and rewriting it would corrupt the sample.
- Text that has been through this once can go through it again unchanged, because the keyword is no longer followed by a reference.

## Rationales

- The phrase is defused rather than forbidden: an agent writing "…then close #1164" as the last step of a plan is describing its plan accurately, and the sentence is worth keeping — what is wrong is only that GitHub acts on it.
- A filler is chosen over wrapping the reference in backticks, which was the first form of this: backticks stopped the closing but also took away the link and the mention on the issue's timeline, so the ticket was no longer told that a pull request had discussed it. Breaking only the adjacency keeps everything a reader gains from the reference and removes just the part a machine acts on.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
