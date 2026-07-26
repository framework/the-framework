Priority: 8
GitHub: [#1149](https://github.com/gemstack-land/the-framework/issues/1149)

# Improve tooltip

## TLDR

The custom tooltip is nice, but: (1) show it immediately (no delay), and (2) use it *everywhere* — some elements still get the system tooltip, which always comes with a bad slow delay. Thread extends into the surrounding action UI: session actions grouped into one dropdown menu (approved — less element shifting between sessions), auto-show the dropdown on hovering any action so the `...` button can go (only if quick-win), and the same treatment for the settings row: drop the `Settings:` prefix, put the gear right of `Autopilot`/`Open PR`, auto-expand on hover, and make `Autopilot`/`Open PR` look like labels rather than buttons.

## Why it matters

High-priority UX paper cut: tooltip latency and inconsistency make the whole dashboard feel sluggish and unpolished, and the action/settings rows are touched on every session visit. The dropdown grouping decision also stabilizes layout across sessions with different action counts.

## Status

The OP's two items are done: every tooltip opens with no delay (the shared `TooltipTrigger`
defaults to `delay={0}`, which beats any provider), and the ~40 remaining native `title=`
tooltips on buttons, menu items and indicators are the custom one now — including the
`Open in editor` button the second screenshot was taken on. What is left on the elements is
`title` as an overflow fallback on `truncate` text, and `title` props on `Section`/`Dialog`.

Still open: the thread's design follow-ups (auto-show the dropdown on hover so the `...`
button can go, and the settings-row redesign).

## Source

Imported from GitHub issue [gemstack-land/the-framework#1149](https://github.com/gemstack-land/the-framework/issues/1149), created 2026-07-25, label: `priority: high`, 4 comments.

### Original description

This tooltip is nice:

<img width="238" height="121" alt="Image" src="https://github.com/user-attachments/assets/b56576e4-c008-49e6-8c37-bc882f0f99fb" />

But:
1. Show it immediately (no delay)
2. Always use it, sometimes the system tooltip is used (which always comes with a bad slow delay):

<img width="263" height="114" alt="Image" src="https://github.com/user-attachments/assets/89e0daff-6093-4fa8-831f-1d8d4b9ccb65" />

### Notes from the GitHub thread

- Session actions were grouped into one dropdown menu ("Love it, awesome idea") — preferred over separate buttons because the action count changes per session and separate buttons shift elements around; the dropdown content will be improved further.
- Follow-ups proposed: auto-show the dropdown when any action is hovered (removing the `...` button, only if quick-win); for the settings row (screenshot: https://github.com/user-attachments/assets/f791b4eb-60fc-48a6-8438-c4291da432c9) remove `Settings:`, show the gear on the right side of `Autopilot`/`Open PR`, auto-expand on hovering any setting, and make `Autopilot`/`Open PR` look like labels (they currently look too much like buttons).
