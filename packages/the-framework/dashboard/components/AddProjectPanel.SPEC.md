The "Add project" dialog: the user types the absolute path of a repo — or of a folder of repos — confirms they trust it, and the daemon activates and registers each repo found there.

## Business logic — TL;DR

- **A path, or a folder of them** - one repo by path, or every git repo directly under a directory when "It's a folder of repos" is ticked.
- **Trust gate before installing** - nothing is registered until the user confirms they trust the repo, warned in plain language about prompt injection.
- **Says what it registered** - on success it reports how many projects were added and how many were already activated, then closes itself shortly after.

## Business logic

### A path, or a folder of them

#### User story

The user has a repo on this machine (or a whole directory of them) that they want The Framework to work on.

#### Business logic

The user enters the absolute path and optionally ticks "It's a folder of repos". Add is disabled until the path is non-empty and while a request is in flight. Submitting does not register anything yet — it moves to the trust confirmation. Cancel, Esc, and clicking outside the dialog all close it without adding; keyboard focus stays inside the dialog and returns to the control that opened it once it closes.

### Trust gate before installing

#### User story

Registering a repo lets agents read its files, so a repo the user does not trust is a prompt-injection risk.

#### Business logic

Before adding, the dialog shows the path back to the user and states that hidden instructions in an untrusted repo can hijack the agent, and that only trusted repos should be added. "I trust it, add it" hands the path to the daemon, which activates and registers the project (or every repo in the folder); Back returns to the path form. A failure is reported in place and returns the user to the path form so they can correct it.

### Says what it registered

#### User story

Adding a folder of repos can register any number of projects at once; without a count the user cannot tell whether anything happened.

#### Business logic

On success the dialog reports how many projects were added and, when some of the repos were already activated, how many were skipped for that reason. It closes itself a couple of seconds later, or immediately on Done.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
