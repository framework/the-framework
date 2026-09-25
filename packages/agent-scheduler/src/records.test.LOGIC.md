What the tests cover, against a real repository with an origin and an `agent-data` branch, the records written by `agent-runner`:

- **The last start** - the newest start among a command's cards on any machine, a done and a failed one included, while a running card without `agent-runner`'s mark does not count; a command never started has none.
- **In flight** - the running cards of one command count whatever the machine; another command's and a running card without `agent-runner`'s mark do not.
- **The command a run counts for** - `/triage quick` counts for the schedule line `triage quick`; `/triage` for `triage`; `/work-queue now` for `work-queue`; a follow-up's `/post-merge-cleanup <id>` for `post-merge-cleanup`; a plain sentence for its first word; with no schedule, `/triage quick` for `triage`; a card without `agent-runner`'s mark for no command.
