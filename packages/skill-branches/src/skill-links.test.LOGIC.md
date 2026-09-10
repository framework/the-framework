What the tests cover, against a real git repository:

- **The skill in every checkout** - a checkout the package creates has `.claude/skills/branches` and `.agents/skills/branches` linking to this package's directory, whose `SKILL.md` names the skill `branches`; the checkout still reads clean to git; linking again changes nothing.
- **An entry already there is left alone** - a file placed at a link's path survives another linking pass.
- **Further skills named by the caller** - a skill given by name and directory is linked beside the package's own in both places, under its own name, and the checkout still reads clean.
