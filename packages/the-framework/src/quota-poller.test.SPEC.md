Tests that the poller keeps the last good reading through transient failures, backs off to a ceiling while refused and recovers when reads work again, gives up only on authoritative failures, and survives unrecognized readouts and a reader that throws.

## Before modifying/creating SPEC.md files

Always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
