An in-memory runner for tests: a pretend workspace with programmable command results and a record of everything autopilot did, so orchestration logic can be exercised without any real sandbox.

## TLDR

- Files live in memory; commands return canned results, configurable per command; previews and background servers are simulated and can each be switched off to mimic a less capable runner.
- Every command, background start, and booted session is recorded so tests can assert what autopilot actually did.
- It enforces the same workspace-escape rules as the real runners, so tests that only run against the fake stay honest.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
