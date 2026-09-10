What the tests cover, for the strip that names the agent options the next agent [1] will start with:

- **Nothing on, nothing shown** - with every option off, the strip renders nothing at all.
- **What is in play is named** - the options that are on are listed by their labels, and an option that is off is absent.
- **An option a rule turned off is not in play** - an option stored as on but disabled by a rule is left out, however it is stored, because it is not what the agent [1] will do.
- **The repository's values are marked as not the user's** - a chip whose value comes from the project's committed `the-framework.yml` carries the word "repo" and says so on hover, while a chip from the user's own preferences [2] carries no marker and says on hover that it is the user's setting.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
