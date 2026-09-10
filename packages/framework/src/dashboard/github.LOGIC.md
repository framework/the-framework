Derives a project's place on GitHub from its `origin` remote: the `https://github.com/<owner>/<repo>` URL the project panel's "Open on GitHub" links to, and the owner and repository name other GitHub reads address. Only a remote on `github.com` counts, in any of its spellings (`git@github.com:owner/repo.git`, `ssh://git@github.com/owner/repo.git`, `https://github.com/owner/repo.git`, with or without `.git`, an embedded credential, or a trailing slash); anything else resolves to nothing rather than to a wrong link. The read is safe anywhere: where there is no `origin`, git fails, or there is no local checkout at all (an agent [1] run on a device [2] through the relay [3]), the answer is simply "not on GitHub".

## Glossary

[1] agent: The unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] device: Another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[3] relay: Running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.

## Business logic — TL;DR

- **A GitHub remote becomes one canonical URL** - the scp-style, ssh and https forms of a `github.com` remote all normalize to `https://github.com/<owner>/<repo>`, dropping a `.git` suffix, an embedded credential and a trailing slash.
- **Anything else is "not on GitHub"** - a remote on another host, a remote with no owner and repository pair (a bare `https://github.com/` or an owner alone), an empty remote, a missing `origin`, or a git failure all answer nothing, never a guessed link.
- **The owner and repository name** - the same normalization split into its two parts, for callers that address GitHub by repository rather than by link.
