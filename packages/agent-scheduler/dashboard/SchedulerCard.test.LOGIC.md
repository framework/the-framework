What the tests cover, with a fake dashboard host:

- **One row per project** - with one project whose scheduler is on and ticked and one whose scheduler is off and keeps alive: "on" in green, "off", the "keep-alive" chip, each project's model, and the last tick's decisions as "<command>: <outcome>"; the decision that started a run is a button, and clicking it opens that agent in its project; a decision that started nothing is plain text.
- **A tick that decided nothing** - its note is shown after the tick's age; a scheduler whose state says on but whose process is gone reads "on, not running" in amber.
- **A project that cannot be read** - reads "not readable" with the reason under it.
