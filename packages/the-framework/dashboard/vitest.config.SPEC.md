Test-runner setup for the dashboard's unit tests: jsdom and the JSX transform, with the root pinned to this directory because the package's `test` script runs from one level up.

## Rationales

- The package runs two test suites: `node --test` covers the compiled `src/`, and this one covers the browser half.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
