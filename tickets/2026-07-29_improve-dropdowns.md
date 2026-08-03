Status: open
GitHub: [#1368](https://github.com/gemstack-land/the-framework/issues/1368)

# Improve dowdowns

## TLDR

Dropdown follow-ups split out of #1149 ("Improve tooltip", now closed in favor of this): auto-show the session-actions dropdown when any action is hovered so the `...` button can go (only if quick-win); and redesign the settings row — drop the `Settings:` prefix, put the gear on the right of `Autopilot`/`Open PR`, auto-expand on hover, and make `Autopilot`/`Open PR` look like labels rather than buttons.

## Why it matters

These are the surviving design follow-ups from the #1149 thread (its tooltip work — zero-delay, custom tooltip everywhere — is done). The action and settings rows are touched on every session visit; hover-expansion and label-like settings reduce chrome on the dashboard's most-used surface. Grouping actions into one dropdown was already approved there because it stops elements shifting between sessions with different action counts.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1368](https://github.com/gemstack-land/the-framework/issues/1368) (title verbatim, sic), created 2026-07-29, no labels, 0 comments. The OP is only two links into the #1149 thread; the substance above is carried over from that thread's notes before its ticket was removed.

### Original description

See:
- https://github.com/gemstack-land/the-framework/issues/1149#issuecomment-5078967662
- https://github.com/gemstack-land/the-framework/issues/1149#issuecomment-5078989838

### Carried over from #1149 (closed)

- Session actions were grouped into one dropdown menu ("Love it, awesome idea") — preferred over separate buttons because the action count changes per session and separate buttons shift elements around; the dropdown content will be improved further.
- Follow-ups proposed: auto-show the dropdown when any action is hovered (removing the `...` button, only if quick-win); for the settings row (screenshot: https://github.com/user-attachments/assets/f791b4eb-60fc-48a6-8438-c4291da432c9) remove `Settings:`, show the gear on the right side of `Autopilot`/`Open PR`, auto-expand on hovering any setting, and make `Autopilot`/`Open PR` look like labels (they currently look too much like buttons).
