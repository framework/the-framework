What the tests cover:

- **A run id** - letters, digits, dashes and underscores name a run; an empty string, `../escape`, `a/b`, `.`, `..`, a name with a space or a dot do not; a card file's name yields its id, while a diary file, a hidden `.json` file and a stray note yield none.
- **A person's directory** - a git email is trimmed and lowercased; hostile values (`..`, `.`, a path with parent references, a hidden name, an absolute path, `..@evil.com`) never start with a dot or contain a slash; `..`, no email, a blank email and a 200-character one all file under `anonymous`.
- **Reading a card** - the skill's fields come back with the writing program's record under `caller` and nothing else, unknown fields dropped; the public card carries no `caller`; a field of the wrong shape (a pull request with a text number, a text cost, an array as `caller`) is dropped rather than kept.
- **What is not a card** - text that is not JSON, an array, a card without a status, an unknown status and an unsafe id all read as none.
- **Writing a card** - the skill's fields first, `caller` last, a trailing newline, absent fields not written, and the result reads back as the same card.
- **The diary** - a line without a `kind` and a value that is not an object are not lines; the agent's four kinds are kept with any extra fields they carry, among the writing program's own kinds; a known kind with missing or wrong fields (`said` without a text, `ended` with status `running`, `cost` with a text `usd`) is not the agent's line; a diary is written one object per line.
- **A torn line** - ends the read and keeps every line before it.
- **Matching and ordering** - a run worked a ticket by its exact path or its file name, not by a suffix of the file name, and a run with no ticket matches nothing; newest first is the id order reversed.
