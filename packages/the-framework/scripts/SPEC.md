The two steps that stand between the product's sources and a working build: turning the prompts the product ships into something the code can import, and running the product's test suite in isolation from the developer's own machine.

## Business logic — TL;DR

- **Prompts are authored as markdown and compiled into strings** - the system prompt and every built-in preset live as markdown files, and are compiled before every build, test run, and type check so the code and the browser can both use them without reading files; described in its own spec.
- **The test suite runs against a throwaway per-user state** - the tests are given an empty stand-in for the user's configuration directory, so they never read or disturb a developer's registered projects or a daemon running on the same machine; described in its own spec.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
