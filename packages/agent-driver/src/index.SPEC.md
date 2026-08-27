The package's main entry point: the driver contract itself and the set of implementation ids, the three drivers that satisfy it (Claude Code, Codex, the `actions` run target), the fake driver, reading where the account's quota stands, the process engine a further CLI-backed driver would be built on, and the event-stream helper a driver implemented outside the package (The Framework's cloud hand-off) builds its events with. No business logic of its own. The Actions run target's internal archive reader is deliberately not offered, since nothing outside that driver uses it.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
