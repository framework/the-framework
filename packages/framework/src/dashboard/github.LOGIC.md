Derives a project's place on GitHub from its `origin` remote: the `https://github.com/<owner>/<repo>` URL the project panel's "Open on GitHub" links to, and the owner and repository name other GitHub reads address. Only a remote on `github.com` counts, in any of its spellings (`git@github.com:owner/repo.git`, `ssh://git@github.com/owner/repo.git`, `https://github.com/owner/repo.git`, with or without `.git`, an embedded credential, or a trailing slash); anything else resolves to nothing rather than to a wrong link. The read is safe anywhere: where there is no `origin`, git fails, or there is no local checkout [1] at all (an agent [2] run on a device [3] through the relay [4]), the answer is simply "not on GitHub".

## Glossary

[1] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is the project's checkout.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[4] relay: running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.

## Business logic — TL;DR

- **A GitHub remote becomes one canonical URL** - the scp-style, ssh and https forms of a `github.com` remote all normalize to `https://github.com/<owner>/<repo>`, dropping a `.git` suffix, an embedded credential and a trailing slash.
- **Anything else is "not on GitHub"** - a remote on another host, a remote with no owner and repository pair (a bare `https://github.com/` or an owner alone), an empty remote, a missing `origin`, or a git failure all answer nothing, never a guessed link.
- **The owner and repository name** - the same normalization split into its two parts, for callers that address GitHub by repository rather than by link.
