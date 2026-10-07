Says whether a word names a branch, by git's own rules for a branch name, without running git.

## Context

**User story**: the user picks "My local branch" in the launcher, and the agent starts from that branch.

**Problem**: the branch a Start names is handed to the project's start hook, which puts it on a command line (`agent-runner run --base <name>`). The Start comes from a browser, so the word is not trusted: one that starts with `-` could be read there as an option, and one that git reads as a range or as a commit other than a branch's would start the agent somewhere nobody picked.

## Business logic — TL;DR

- **A branch name** - text of 1 to 255 characters that `git check-ref-format --branch` takes, `HEAD` and `@` excepted; anything else is refused.

## Business logic

### A branch name

#### Context

See `## Context`. The daemon's Start asks (`daemon-runtime.ts`).

#### Business logic

A value is a branch name when it is text, not empty, at most 255 characters long, and none of these holds:

- it starts with `-`;
- it is `HEAD` or `@`, which git reads as the current commit;
- it holds a space, a control character, or one of `~ ^ : ? * [ \`;
- it holds `..` or `@{`;
- it ends with `.`;
- one of its parts between slashes is empty (a leading slash, a trailing slash, two slashes in a row), starts with `.`, or ends with `.lock`.

Whether a branch of that name exists is not asked here: the tool that starts the agent finds out.
