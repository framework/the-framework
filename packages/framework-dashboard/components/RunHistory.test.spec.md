Tests for `RunHistory.tsx` — covers row states, shared-shell behavior, the New button, Tickets nav and cloud sessions.

## TLDR

- #785: running pulses; `settledAt` on a live run reads "waiting" without animation; a finished run never reads waiting (stale settledAt must not relabel a terminal status).
- #784: a selected run whose row hasn't landed highlights the optimistic "starting…" row, not the New/home row.
- Rows: device glyph names the device for `target: 'remote'` (#1067), absent locally; Overview pools cross-project recents and a row click jumps into its project; empty state still shows New + "No sessions yet.".
- New button: one project starts there, inside a project starts there, several projects renders a picker (aria-haspopup).
- Tickets nav (#1144): offered with/without a project when `onTickets` given, absent otherwise; `ticketsActive` puts `aria-current="page"` on Tickets and off Overview.
- Cloud (#1263/#1264): done `web` runs read "in cloud" with the cloud glyph while still naming Claude Code as agent; stopped web runs read stopped; local done runs stay "done".

## Facts

- Renders must be wrapped in `SidebarProvider` (shadcn Sidebar context); telefunc shims and the chrome components (ThemeToggle etc.) are mocked to keep telefunc out of jsdom.
