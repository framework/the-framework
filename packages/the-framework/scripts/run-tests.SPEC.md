Runs the product's compiled test suite in isolation from the machine it runs on, so the tests neither read nor disturb the developer's own installation of The Framework.

## Business logic — TL;DR

- **The tests never see the real per-user state** - each test suite gets an empty throwaway location standing in for the user's own configuration directory, and that location is deleted afterwards whether the tests passed, failed, or never started.
- **A stuck test fails instead of hanging** - every test is bounded by a one-minute limit.
- **The suite's verdict is the command's verdict** - the tests failing, or being killed, reports failure; extra arguments are handed to the test suite so a subset can be selected.

## Business logic

### The tests never see the real per-user state

#### User story

A developer working on The Framework runs the test suite on the same machine where they use the product — with their own projects registered and, often, their daemon running and their dashboard open in a browser.

#### Business logic

The registry and the daemon's own state file live in the user's configuration directory, which is machine-global. The test suite is pointed at a fresh empty directory instead, created for that suite and removed once it ends, so no test can find or modify the developer's registered projects, preferences, secrets, or daemon token.

#### Rationale

The isolation is applied once for the whole suite rather than inside each test, because a single test that reaches the real location is enough to cause the failure: finding a live daemon there, it starts following that daemon's steering files, which keeps the test alive until its time limit expires. The symptom is a test failing for developers who happen to have the dashboard open and passing for everyone else.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
