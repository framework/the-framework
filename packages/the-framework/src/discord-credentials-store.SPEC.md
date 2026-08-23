Storing the user's Discord credentials in the registry from the dashboard, and telling the daemon to pick them up right away.

## Business logic — TL;DR

- **Saving a credential takes effect now** - after the credential is written, the daemon's Discord services are rebuilt against it, so notifications start without a daemon restart.
- **A credential set in the daemon's environment is not editable here** - the save is refused by name rather than writing a value that the next read would shadow anyway.
- **Nothing is written until every part of the save is valid** - an invalid value is refused with the reason, and a save that changes nothing succeeds without touching the registry.
- **A failed rebuild is not a failed save** - the credential is stored either way, and the next daemon start uses it.

## Business logic

### Saving a credential takes effect now

#### User story

The user pastes a Discord webhook into the dashboard's settings. Discord notifications must start working immediately, not the next time they restart the daemon.

#### Business logic

A credential is written to the registry and the daemon is then asked to rebuild its Discord services against it. The rebuild is asked for only after the write, so it can never read the value it is replacing. A rebuild that fails does not turn a successful save into a failure: the credential is stored, and the next daemon start uses it.

Reading the current state answers where each credential stands — including whether it comes from the daemon's environment rather than from the registry.

### A credential set in the daemon's environment is not editable here

#### User story

The user runs the daemon with a webhook set in its environment, then tries to change it from the dashboard.

#### Business logic

Such a save is refused, naming the environment variable that owns the value. Accepting it would write to the registry a value the next read would shadow — silently doing nothing, which is worse than saying no.

### Nothing is written until every part of the save is valid

#### Business logic

Each credential in a save is validated before anything is written, and the first invalid one refuses the whole save with the reason. Clearing a credential is always allowed. A save that carries no credential at all succeeds without touching the registry.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
