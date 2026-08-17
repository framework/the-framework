The one retirement on this branch that is not silent: the per-project settings tier that was deleted, reported once at boot to whoever set it.

## TLDR

- Every other renamed or removed key is simply unknown now, because a migration path is a branch every reader carries forever. This one gets a notice instead of a migration: it is still not read, honoured, or written back — it is named.
- The reason is direction. Dropping this tier lands those repos on the user's default, and the default publishes: a repo set to "don't publish" starts pushing branches and opening pull requests under the user's name. A setting that quietly stops applying is a bug report; a setting that quietly starts publishing is a pull request on someone else's repo.
- Read at boot, before anything can write. The registry is rewritten from the fields it knows, so the session's first preference write erases the block — a notice raised at the first publish would race that erasure and lose.
- It names the repo and the exact line that replaces the setting, so acting on it is a copy rather than a search. A repo whose block never set publishing has nothing outward to lose, and is told its user-level settings apply instead.
- A block written before the publish ladder said the same thing in three booleans, and turning those back into a rung would need the mapping this branch deleted. Such a block is recognized as having set publishing without being interpreted: the row says to restate it, and offers the ladder's own words. Reassuring that reader would be the failure this whole notice exists to prevent.
- One wording, written here, printed by the log and handed to the dashboard already written. The judgement about what a removal did to a repo is not something two surfaces should each phrase for themselves.
- Nothing is withheld pending an acknowledgement, and nothing is written into the user's repo on their behalf: the first is the deleted tier under another name, the second is a bigger outward action than the one being prevented.
- It reaches the dashboard, not just the daemon's stdout. The premise of the product is that nobody is at the keyboard, which makes a line on boot the one place it would not be read.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
