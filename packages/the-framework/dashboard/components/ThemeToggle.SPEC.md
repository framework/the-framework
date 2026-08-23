The dashboard header's appearance control: a menu offering System, Light and Dark, where System is the default.

## Business logic — TL;DR

- **One setting, shown where it is always reachable** - the control writes the theme preference the whole dashboard reads, and sits in the header so it is present on every screen.
- **The trigger wears the current choice** - the header's icon and its tooltip ("Theme: System" / "Light" / "Dark") say which theme is on without opening the menu; the menu ticks the active choice.
- **The menu stays open on a pick** - so the user sees the dashboard change appearance under the choice they just made and can try another immediately.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
