The dashboard's side of its conversation with the daemon: one typed handle per action the daemon offers, plus the subscription to an agent's live event stream. Everything the dashboard asks the daemon for goes through here, and nothing else in the dashboard talks to the daemon directly.

## Business logic — TL;DR

- **A rename is a build error, not a 404** - every handle is declared against the daemon's own implementation of that action, so renaming an action or changing what it takes or returns breaks the dashboard's build, instead of surfacing as a button that fails against a missing route once a user clicks it.
- **The daemon's code never reaches the browser** - only the shapes the two sides speak in are borrowed from the implementations; none of the daemon's actual code is shipped to the browser.
- **Grouped by what they are for** - steering a running agent, reading what the pages render, the projects, the settings, the quota panel, the saved devices, and the live event stream.

## Business logic

### A rename is a build error, not a 404

#### User story

The user clicks Stop, or opens the Tickets page. Whatever the daemon offers, the dashboard must actually reach — a mismatch between what the browser asks for and what the daemon offers is invisible until someone hits that exact button, and then it fails in front of the user.

#### Business logic

Each handle names the daemon action it stands for and is bound to that implementation's own signature. Renaming an action, changing its arguments, or changing what it answers with therefore fails the dashboard's build until every place that calls it is updated.

#### Rationale

The handles were once thin re-exports whose only purpose was to pin each action to the file path it was re-exported from, so renaming a file broke every call made through it. Calls are addressed by the action's name now, so where a handle lives carries no meaning.

### The daemon's code never reaches the browser

#### User story

The dashboard is a browser app; the daemon runs on the user's machine with access to their repositories, their registry, and their credentials. None of that may end up downloaded into a browser tab.

#### Business logic

The handles borrow only the shapes the two sides exchange, which exist purely to be checked and disappear when the dashboard is built. The daemon's own code stays on the daemon and is never bundled into the browser app.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
