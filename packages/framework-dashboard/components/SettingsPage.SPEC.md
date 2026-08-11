The settings page: every setting in one findable place — appearance, agent and model, where runs execute, run options, eco, notifications, automation, saved devices and the browser bridge — plus the non-dismissible onboarding checklist.

## TLDR

- Everything here writes the global default; per-project overrides stay where a run is configured, in the launcher's gear.
- The run-options table is the very one the launcher renders, its rules applied identically, and a rule-disabled row stays visible, greyed with its reason — the whole point of the page is being where you come to look.
- A toggle is a preference; whether it can deliver is a capability: blocked browser notifications and unconfigured Discord channels read as such, with their setup dialogs right beside the toggle.
- Typed automation values are clamped to the same bounds the daemon enforces, and an untouched value shows the real default in force rather than a zero nothing is using.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
