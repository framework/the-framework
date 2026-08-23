A project's home page: where the user starts agents on that project, and sees what already needs them.

## Business logic — TL;DR

- **The launching pad stays put** - starting an agent opens that agent's own view alongside and leaves this page untouched, so the user can immediately launch another; several agents run on one project at the same time, each in its own worktree.
- **Problems before actions** - anything the daemon currently finds wrong with the project is announced above the start form.
- **What is running right now** - once the project has agent activity, an overview of the current agents sits under the start form.
- **Every parked agent, answerable here** - the open questions list follows, and answering or opening one can jump the user into an agent of another project.
- **The project's PLAN and TODO documents** - shown last, and only when the project has any.
- **The whole column scrolls** - each section can be tall, so the page scrolls as one rather than trapping the user in nested scrollers.

## Business logic

### Problems before actions

#### User story

The user is about to hand a project some work.

#### Business logic

The project error banner sits between the project's action bar and the start form, so the user reads it before writing a prompt.

#### Rationale

An agent started on a project whose data branch cannot reach origin works from stale tickets and writes into an agent queue nobody else will ever see. Naming that failure after the start form would be too late.

### Every parked agent, answerable here

#### User story

The user wants one place to clear the questions agents are waiting on, instead of visiting each agent in turn.

#### Business logic

The open questions section pools the pending gates of all live agents across every project, so the user can answer them from this page and open the agent that asked — even one belonging to a different project.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
