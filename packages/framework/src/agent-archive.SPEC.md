Decides which per-user directory a project's archives are filed under on the logs branch (`agents-logs`), so that every finished agent's lasting record survives the repo being cleaned and two people working the same repo never write to the same paths.

## Business logic — TL;DR

- **Archives are filed per user** - a finished agent's archive lands under `agents/<user>/` on the logs branch, where `<user>` comes from the git identity the repo already commits with.
- **The directory name can never climb out of the archive** - the identity is reduced to a conservative, lowercased name that must start with a letter or digit; anything that cannot be made to fit is filed under `anonymous` instead.
- **A missing identity still gets a home** - when git has no configured identity, the archive goes to `anonymous` rather than being dropped.
- **The identity is read once per repo** - resolved on the first archive and reused for the rest of the daemon's life, with an explicit way to forget it.

## Business logic

### Archives are filed per user

#### User story

Several people work the same project from their own machines. Each of them wants their finished agents kept, and none of them wants a merge conflict every time somebody else finishes an agent.

#### Business logic

An archive is written under a directory named after the user, inside the archive directory `agents/` on the logs branch. Because each person's archives sit under their own directory, two people's histories sit side by side instead of overwriting the same paths. The whole team can see everybody's list; that visibility is intended.

The identity used is the email that `git config user.email` reports for the project, so there is nothing extra for the user to configure and the directory matches the name that appears on the commits.

#### Rationale

Agent state used to be written to `.the-framework/agents/`, which the install-time `.gitignore` keeps untracked. An ordinary `git clean -fdx` therefore deleted every agent a project had ever run, and nothing was recoverable because nothing had ever been committed. Keeping the lasting copy on the logs branch is what makes the history survive.

### The directory name can never climb out of the archive

#### User story

The user's git identity is repo configuration — the framework treats it as untrusted input, because it is joined onto a filesystem path.

#### Business logic

The email is trimmed, lowercased, and every character outside a conservative allowed set is replaced by `-`. The resulting name is accepted only if it is non-empty, no longer than 64 characters, and starts with a letter or digit. Requiring a leading letter or digit is what rules out `.`, `..` and dotfile-style names, so no identity can produce a directory that escapes the archive. A name that fails any of these checks falls back to `anonymous` rather than to a guess. The 64-character limit is well past any real address and keeps the archive paths inside the path length limits of every supported platform.

### A missing identity still gets a home

#### User story

A user runs an agent in a repo where they never configured a git identity, and still expects to find the finished agent afterwards.

#### Business logic

When the identity is missing or cannot be read, the archive is filed under `anonymous`. Keeping the history under a placeholder is preferred over dropping it.

### The identity is read once per repo

#### User story

The daemon archives many agents over a long uptime and should not pay for re-reading configuration that essentially never changes.

#### Business logic

The resolved directory name is remembered per project for the daemon's life. A git identity changes about as often as never, and an agent that outlived such a change would only mean that the next agent files itself correctly. The remembered names can be forgotten explicitly, which is what a daemon that outlives a configuration change uses.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
