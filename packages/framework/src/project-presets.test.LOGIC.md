What the tests cover:

- **Reading never fails** - a missing file and a file that is not valid JSON both read as no presets.
- **Round trip** - a saved list reads back exactly as saved.
- **Sanitizing on write** - labels and prompts are trimmed; an entry with no id, an entry whose id duplicates an earlier one, and an entry with no prompt are dropped.
- **Git tracks the file** - a save adds the line `!custom-presets.json` to `.the-framework/.gitignore`; a second save does not add it twice; saving an empty list keeps the file, holding an empty list, and keeps the un-ignore line.
