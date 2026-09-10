What the tests cover:

- **The default script** - the demo is a single build turn and carries no gate.
- **The single-choice variant** - `choices` yields an ask turn whose gate parses, recommends its first option ("Session cookies"), and is followed by a resume turn with no gate, so the agent continues.
- **The checklist variant** - `multiselect` yields a multi-select gate whose pre-checked options are "auth model" and "orders schema".
- **An unknown variant** - plays the default script.
