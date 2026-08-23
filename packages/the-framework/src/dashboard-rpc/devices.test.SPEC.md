What the tests cover: each saved device is reported as reachable only when it actually answers — a device that rejects the token and a device with nothing listening both read as unreachable. Malformed device entries are dropped instead of being pinged or appearing in the result, and checking no devices answers with nothing.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
