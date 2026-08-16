The dashboard's shared kit of basic interface pieces — buttons, inputs, menus, dialogs, tooltips, scroll areas, the sidebar shell — hand-ported shadcn-style components rather than product logic, so every panel looks and behaves the same.

## TLDR

- Two dialog tiers on purpose: an irreversible action goes through a focus-trapped confirm dialog a stray click cannot dismiss, while ordinary forms and drawers close on Esc or a click outside.
- Scrollbars are the app's own — thin, themed, visible only while content overflows — never the OS overlay bar that hides itself.
- The chat log's viewport follows the live edge of a streaming conversation, holds your place when you scroll up, and offers a jump-to-latest button.
- The sidebar shell adapts by screen: a collapsible rail on desktop whose state survives reloads, a slide-in drawer on mobile.
- Popups (menus, popovers, tooltips) share one surface look, and a trigger stays highlighted while its popup is open.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
