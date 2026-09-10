Reads one file out of a checkout [1] for the file tree's hover card, and holds the two safety rules every read of a browser-supplied path goes through, the diff in `file-diff.ts` included: which paths may be asked for at all, and the confined read that stays inside the checkout even when a symlink points out of it. The contents of an unchanged file come back cut at 500 lines, flagged when cut, or flagged as binary when they are not text, and always from the checkout the caller resolved, so an agent's [2] hover shows its own copy rather than the project's.

## Context

**User story**: hovering a file in the dashboard's file tree shows its contents, whether or not the agent [2] changed it, without any way for the browser to read a file the checkout does not contain.

**Problem**: the path comes from the browser. Without a guard, a crafted path could read the machine's own files, a repository's `.git/config` with its credentials, or be read by git as a flag.

## Glossary

[1] checkout: An agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is the project's checkout.
[2] agent: The unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.

## Business logic — TL;DR

- **Which paths may be read** - only a plain repository-relative path: no traversal, no absolute path, no leading dash, never into `.git`, no empty segment, at most 1024 characters.
- **The read stays inside the checkout** - the file's real path, symlinks resolved, must sit under the checkout's real path, so a link pointing outside is refused and a missing or unreadable file yields nothing.
- **A file's contents for the hover card** - text is returned without its trailing newline and cut at 500 lines with a flag; a file with a NUL byte is reported as binary with no text; an empty file is an empty text, not "nothing".

## Business logic

### Which paths may be read

#### Context

See `## Context`.

#### Business logic

A path may be read only when it is a plain repository-relative path: non-empty, at most 1024 characters, without a NUL byte; not absolute (no leading `/`, no Windows drive letter); not starting with a dash, which git would read as a flag; and, splitting on either slash, with no segment empty, `.` or `..`. No segment may be `.git`, in any position and compared case-insensitively: a nested repository's `.git/config` holds credentials too, and on macOS and Windows `.GIT/config` opens the very file this refuses. Rejecting is the whole contract; the caller resolves an accepted path against a checkout [1] it chose.

### The read stays inside the checkout

#### Context

**Problem**: a path that passes the guard can still leave the checkout [1] through a symlink: `src/link.txt` pointing at a file elsewhere on the machine resolves textually to a path under the checkout while the read leaves it.

#### Business logic

The checkout's real path and the file's real path, both with symlinks resolved, are compared: the file must lie strictly under the checkout, or nothing is read. A file that does not exist has no real path, so "not there" is answered before any read; a checkout whose real path cannot be resolved, or a file that cannot be read, yields nothing too. Resolving the checkout's own path as well is what makes the comparison hold on platforms whose temporary directories are themselves links.

### A file's contents for the hover card

#### Context

See `## Context`.

#### Business logic

The file is read through the confined read above, so an unsafe, outside, missing or unreadable file yields nothing. A file containing a NUL byte is reported as binary, with no text to render. Otherwise its text is returned without a trailing newline (which would read as a blank last line), cut at 500 lines when longer and flagged as truncated in that case; an empty file yields an empty text rather than nothing. A file git has not touched is still read from the resolved checkout [1], so an agent's [2] hover shows its own copy rather than the project's.
