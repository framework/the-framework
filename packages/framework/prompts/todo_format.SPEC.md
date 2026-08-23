The file format every agent must follow when it reads or writes the agent queue (`TODO_AGENTS.md`): the confirmed list of everything agents will work on next, banded by priority.

## Business logic — TL;DR

- **One file, banded by priority** - each priority from 10 down to 0 is a section; priority 10 means critical, act immediately, and 0 means only if there is capacity.
- **Order inside a band is order of work** - the entries at the top of a band are the next ones to be taken from it.
- **An entry stands on its own** - either a succinct description linking to the details, or a self-contained description complete enough to work from.
- **Done means deleted** - an entry is removed from the file when it no longer applies.

## Business logic

### One file, banded by priority

#### User story

The user wants one authoritative answer to "what will the agents do next", and wants to be able to reorder it by editing a markdown file.

#### Business logic

The agent queue lists *all* the tasks agents will work on next, sorted by priority. Each priority level is its own section, running from 10 down to 0. Priority 10 is described as rarely used — critical production bugs and the like — and is to be treated as the utmost priority; priority 0 means the task is only worth doing if there is spare capacity.

### Order inside a band is order of work

#### User story

Two tasks of equal priority still have an order the user cares about.

#### Business logic

Within one priority section the earlier entries have the higher priority: each section is its own queue, and its first entries are the next tasks to be taken from it.

### An entry stands on its own

#### User story

An entry is picked up later, by an agent that was not present when it was written.

#### Business logic

An entry is either a succinct description carrying a link to the details, or a self-contained item whose description states completely what should be done.

### Done means deleted

#### User story

The user reads the file as the remaining work.

#### Business logic

Removing an item — for instance because it is done — is simply deleting it from the file. There is no completed state kept in it.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
