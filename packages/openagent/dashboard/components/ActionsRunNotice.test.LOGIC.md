What the tests cover, for the notice shown to an agent running on GitHub Actions:

- **The burst wait is explained** - while an Actions agent runs, the notice says updates arrive when the run finishes.
- **The link to the live run** - once the driver has reported the Actions run's URL in the events, the notice links to it; before that there is no link.
- **A finished Actions agent** - drops the updates-on-completion line but keeps the link.
- **Other agents** - a local agent, or one with no location set, gets no notice at all.
