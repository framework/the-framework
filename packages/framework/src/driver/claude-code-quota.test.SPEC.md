What the tests cover: reading where the account's subscription quota stands out of Claude Code's own usage readout.

- A real readout yields exactly its three quota windows — the current session, the current week across all models, and the current week for one model — each with its percentage used and when it resets. Percentages may be fractional, and a window with no reset phrase is still read.
- The other lines of the same readout that merely resemble a quota window — a usage breakdown, a list of top skills with percentages — are never mistaken for one.
- An account already running on overage still has its quota read, even though the readout's opening line differs from the ordinary subscription case.
- A readout whose figures could not be understood is reported as unreadable, while an account with no subscription quota at all is reported as having none — the two are never confused. An empty readout is never reported as zero used, which would read as "nothing spent" and let unattended work run the allowance dry.
- Failures are classified by whether they are worth retrying: a failed or timed-out read and an unreadable answer are treated as this-attempt problems, while having no subscription and not having the CLI installed are treated as settled facts about the setup.
- The reading asks the CLI for its own usage answer rather than prompting a model, and never in the mode that would pin it to API-key authentication and hide the subscription quota entirely.
- The CLI reporting its own upstream failure, exiting non-zero, printing something unparseable, not being installed, and hanging indefinitely each produce their own distinct outcome.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
