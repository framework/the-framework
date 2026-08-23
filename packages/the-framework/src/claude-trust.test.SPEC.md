What the tests cover: reading and granting Claude Code's per-folder trust.

- Reading tells apart a folder the user trusted, one they were asked about and declined, and one the CLI has never seen — the last is known-untrusted rather than unknown, because that is exactly when the trust dialog would fire.
- A configuration that is missing, unparseable, or shaped unexpectedly answers "unknown" instead of guessing.
- Writing trust makes the folder read as trusted while preserving everything else in the CLI's configuration: its own settings, its other projects, and the folder entry's other fields.
- Writing creates a missing configuration, repairs an unexpectedly shaped projects field, and refuses to replace an existing configuration it cannot parse — leaving that file exactly as it was.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
