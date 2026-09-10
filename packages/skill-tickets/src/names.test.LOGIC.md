What the tests cover:

- **Where tickets live** - the directory is `tickets`, and a ticket's plan and claim are named after its stem (`a.md` gives `a.plan.md` and `a.lock.md`).
- **The bare filename gate** - a plain `.md` name passes; a relative segment, a nested path, an absolute path, a dot-prefixed name, a `.plan.md`, a `.lock.md` and `meta.json` are refused.
- **The path gate** - only `tickets/<file>.md` passes; a relative segment, a nested file, a hidden file, a non-markdown file, an absolute path, a URL, a file outside `tickets/` and the bare directory are refused.
- **Which queue entry names a ticket** - a markdown link into `tickets/` names its ticket; plain text, a mention of a plan outside a link, a link elsewhere and a traversal dressed as a link name none.
- **The priority a ticket earns** - a whole number from 0 to 10 places the ticket in that section, whitespace around it allowed; an absent value, a word, an out-of-range number and a fraction all place it at 5.
- **Which issue a ticket tracks** - the number comes from the URL on the `GitHub:` line, a disagreeing label loses, a bare `#13` counts when there is no URL, and a ticket with no usable line tracks no issue.
