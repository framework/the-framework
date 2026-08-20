Why a pull request that does not finish an issue must not carry a phrase GitHub reads as closing it, and how such a phrase is defused without changing what the sentence says.

## Flows

- A closing phrase is one of GitHub's keywords — close, fix, resolve, and their plural and past forms — followed by an issue reference, in this repository or another.
- Defusing wraps the reference in backticks and leaves every word alone, so the sentence a human reads is unchanged and the pull request stops closing the issue.
- A reference already wrapped is left as it is, so text that has been through this once can go through it again unchanged.

## Rationales

- The phrase is defused rather than forbidden: an agent writing "…then close #1164" as the last step of a plan is describing its plan accurately, and the sentence is worth keeping — what is wrong is only that GitHub acts on it.
- Backticks are the chosen form because they defeat the parser while rendering the same words, where rewording would put the framework in the business of editing an agent's prose.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
