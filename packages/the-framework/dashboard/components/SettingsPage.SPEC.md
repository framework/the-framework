The settings page: every setting in one findable place — appearance, driver and model, where agents execute, agent options, notifications, automation, saved devices and the browser bridge — plus the non-dismissible onboarding checklist.

## TLDR

- Everything here writes the one writable tier — your own settings, which is the default every project starts from. A value that belongs to a repo is committed in that repo's own settings file, and is edited there.
- The agent-options table is the very one the launcher renders, its rules applied identically, and a rule-disabled row stays visible, greyed with its reason — the whole point of the page is being where you come to look.
- A toggle is a preference; whether it can deliver is a capability: blocked browser notifications and unconfigured Discord channels read as such, with their setup dialogs right beside the toggle.
- Typed automation values are clamped to the same bounds the daemon enforces, and an untouched value shows the real default in force rather than a zero nothing is using.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
