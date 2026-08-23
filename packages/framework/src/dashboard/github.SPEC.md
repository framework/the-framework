Works out which GitHub repository a checkout belongs to, from its `origin` remote: the browsable `https://github.com/<owner>/<repo>` address behind the dashboard's "Open on GitHub" link, and the owner-and-name pair that GitHub API calls need.

All three remote spellings are understood — the `git@github.com:` short form, the full `ssh://` form, and `https://` — with a `.git` suffix, an embedded credential and a trailing slash stripped off. Anything that is not a GitHub remote, and anything that does not name exactly one owner and one repository, yields no answer at all, as does a checkout with no `origin` remote or no git at all. That makes the read safe to attempt anywhere, including where there is no local checkout, such as over the relay.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
