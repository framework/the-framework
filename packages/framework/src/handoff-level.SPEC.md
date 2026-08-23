How far a finished agent publishes itself: one ladder of four rungs — `local`, `push`, `pr`, `merge` — where each rung includes every rung below it.

## Business logic — TL;DR

- **One ladder, four states** - `local` keeps the work in its checkout, `push` puts the branch on the remote, `pr` also opens a pull request for it, `merge` also lands that pull request. Reaching a rung means having done everything under it.
- **The default is `pr`** - an agent nobody configured pushes its branch and opens a draft pull request, so finished work never sits on a local branch nobody is told about. Landing on the default branch is the one rung above that, and has to be asked for.
- **The three stage questions always agree** - "is the push armed?", "is the PR armed?", "is the merge armed?" are all read off the one rung, so no two surfaces can disagree about what a finished agent will do.
- **An impossible set of checkboxes resolves downwards** - where a surface offers the stages as separate boxes, the rung is the highest one whose own box and every box beneath it are ticked. "Open a PR but do not push" therefore means `local`.

## Business logic

### An impossible set of checkboxes resolves downwards

#### User story

The dashboard offers the handoff as separate checkboxes, so a user can tick "open a PR" while leaving "push the branch" unticked — a combination no agent can honour, since a pull request needs a pushed branch.

#### Business logic

Such an answer resolves to the highest rung that is fully ticked from the bottom up, which for "PR without push" is `local`: nothing is published.

#### Rationale

The handoff used to be three independent switches, where "open a PR" was documented as implying "push" and the contradiction was resolved by silently switching the push back on. That made "publish nothing" impossible to offer: a launcher could ask for it and not get it. As one ordinal ladder, the impossible combinations simply cannot be expressed, and an ambiguous answer errs towards publishing less rather than more.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
