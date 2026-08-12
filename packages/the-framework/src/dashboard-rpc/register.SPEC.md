Makes every dashboard call answerable by the daemon, which serves a prebuilt dashboard and cannot discover the calls the way a dev server does.

## TLDR

- Every exported call is registered under its own name, so one that is exported but forgotten — which would fail at runtime with a bare error and no clue — is impossible by construction.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
