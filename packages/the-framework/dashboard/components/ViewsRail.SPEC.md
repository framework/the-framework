The dashboard's views rail: the markdown documents an agent pushes to the side panel while it works — a plan, a summary, a writeup — each shown as its own titled view, with a strip to jump between them.

## Glossary

- **view** - a titled markdown document an agent shows the user in the dashboard's side panel. Unlike a gate it never blocks the agent: the agent keeps working whether or not the user reads it.

## Business logic — TL;DR

- **Views arrive live and update in place** - a view appears as the agent pushes it, and an agent re-showing a view it already pushed replaces that view's content rather than adding a second one.
- **A new view selects itself** - the rail switches to a view the user has not seen yet, so a view landing while they read another one is not missed; a re-shown view updates without stealing the selection.
- **One strip, only when needed** - with more than one view a sticky strip of titles sits above the content and jumps between them; with a single view there is nothing to jump between and no strip.
- **Every view is copyable** - each view offers to copy its markdown, since a plan or summary is usually meant to be pasted somewhere else.
- **Nothing yet says so** - an agent that has pushed no view shows "No views yet.", and a view disappearing — as when a new agent replaces the stream — leaves the rail on a view that still exists.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
