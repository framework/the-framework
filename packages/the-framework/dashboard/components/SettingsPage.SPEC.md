The settings page: every setting in one findable place — appearance, driver and model, where agents execute, agent options, notifications, automation, saved devices and the browser bridge (the daemon route a browser extension uses to carry a Claude web session's questions back) — plus the non-dismissible onboarding checklist.

## Flows

- Everything here writes the one writable tier — the user's own settings, which is the default every project starts from. A value that belongs to a repo is committed in that repo's own settings file (`the-framework.yml`), and is edited there.
- The agent-options table is the very one the launcher renders, its rules applied identically, and a rule-disabled row stays visible, greyed with its reason — the whole point of the page is being where the user comes to look.
- A toggle is a preference; whether it can deliver is a capability: blocked browser notifications and unconfigured Discord channels read as such, with their setup dialogs right beside the toggle.
- Typed automation values are clamped to the same bounds the daemon enforces, and an untouched value shows the real default in force rather than a zero nothing is using.
- A row with nothing to pick renders nothing at all: an empty dropdown is a control you can open and not use, which reads as broken rather than as "no choices here".

## Rationales

- The editor dropdown is assembled at run time from the editors detected on the machine; the other lists are static, and the guard against empty dropdowns covers both.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
