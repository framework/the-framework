# Bug analysis: packages/framework/dashboard/components/ui/sidebar.tsx

## Business logic (high-level)

The shadcn Sidebar port (#314): SidebarProvider owns expanded/collapsed state (desktop) and the
off-canvas sheet (mobile), exposes it via context, binds Cmd/Ctrl+B, and *persists* the state.
The ui/SPEC.md names as this kit's product behavior "the side column that remembers whether it is
collapsed". The rest is a large set of styled structural wrappers (header/footer/groups/menus/
rail/inset/skeleton), which I audited for prop-flow and state usage rather than for CSS taste.

Key findings:

- **Persistence is write-only.** `setOpen` writes `document.cookie = 'sidebar_state=…'` on every
  toggle, but nothing anywhere in the dashboard reads that cookie (grepped the whole package:
  the only `document.cookie` reference is this write; `App.tsx` mounts `<SidebarProvider>` with
  no `defaultOpen`/`open` props). Upstream shadcn reads the cookie server-side (Next.js) to seed
  `defaultOpen`; this SPA has no server render, so after any reload the sidebar is always
  expanded again regardless of the stored state. Contradicts ui/SPEC.md's "remembers whether it
  is collapsed". Bug 1.
- **Cmd/Ctrl+B collides with the prompt editor's Bold.** The keydown listener on `window` checks
  only key+modifier — not `event.defaultPrevented` and not whether the event came from an
  editable surface. The PromptEditor is a Tiptap StarterKit editor where Mod-B is Bold;
  ProseMirror handles the combo and calls `preventDefault()` but does **not** stop propagation
  (verified in prosemirror-view 1.42.1: `editHandlers.keydown` only calls `preventDefault`), so
  the event still reaches the window listener and the sidebar toggles while the user is bolding
  text. Bug 2.
- Context: `contextValue` memoized over all fields; `useSidebar` throws outside the provider —
  matches the strict-context convention. Correct.
- `toggleSidebar` routes to `setOpenMobile` on mobile and `setOpen(prev => !prev)` on desktop;
  `setOpen` supports updater functions by evaluating against the closed-over `open` (fresh via
  the useCallback dep). In controlled mode (`onOpenChange` given) it forwards the resolved
  boolean — correct.
- `Sidebar` renders three shapes: `collapsible="none"` (plain column), mobile (Sheet, its own
  width var, hidden-close-button class targeting nothing — see sheet analysis), desktop (gap div
  + fixed container with data-state/collapsible/variant/side attributes driving the Tailwind
  variants). `{...props}` land on the desktop container / none-variant div; the mobile branch
  deliberately does not forward them (documented deviation). Correct.
- `SidebarMenuButton` tooltip: rendered only when `tooltip` given, `hidden` unless collapsed
  desktop — matches "tooltip only when there is no label to read". Correct.
- `SidebarMenuSkeleton` — width derived from `useId` so it is render-stable; documented
  deviation from upstream's Math.random. Correct.
- The remaining wrappers (Trigger, Rail, Inset, Input, Header, Footer, Separator, Content,
  Group*, Menu*, MenuSub*) forward props/className correctly; Trigger composes caller onClick
  before toggling; Rail is `tabIndex={-1}` (pointer affordance only). Correct.

## Functions (low-level)

Covered above; per-function verdicts: `useSidebar` correct; `SidebarProvider` bug 1 + bug 2
(both in its body); `Sidebar` correct; `SidebarTrigger` correct; `SidebarRail` correct;
`SidebarInset` correct; `SidebarInput` correct; `SidebarHeader`/`Footer`/`Separator`/`Content`/
`Group`/`GroupLabel`/`GroupAction`/`GroupContent` correct; `SidebarMenu`/`MenuItem`/
`sidebarMenuButtonVariants`/`MenuButton`/`MenuAction`/`MenuBadge`/`MenuSkeleton`/`MenuSub`/
`MenuSubItem`/`MenuSubButton` correct.

## Bugs found

1. `L67` (init; the dead write is `L78`): **The collapsed state does not survive a reload — the
   cookie is written but never read.** Scenario: collapse the sidebar (Cmd/B or trigger), reload
   the dashboard → sidebar is expanded again; the `sidebar_state` cookie sits unused. Contradicts
   ui/SPEC.md ("the side column that remembers whether it is collapsed"). Severity: minor.
   Fix sketch: seed the state from the cookie in a lazy initializer —
   `useState(() => document.cookie.match(/(?:^|; )sidebar_state=(true|false)/)?.[1] !== 'false' ?? defaultOpen)`
   (guarding for non-browser), or read it in App and pass `defaultOpen`.

2. `L88`: **Cmd/Ctrl+B toggles the sidebar even when the prompt editor already used it for Bold.**
   The window keydown handler ignores `event.defaultPrevented`; ProseMirror's keymap handles
   Mod-B (StarterKit Bold — "Markdown is live" per PromptEditor) with `preventDefault()` but
   without stopping propagation, so bolding text in the composer simultaneously collapses/expands
   the sidebar under the user's hands. Severity: minor. Fix sketch: bail when
   `event.defaultPrevented` (covers the editor case exactly); optionally also when
   `event.target` is editable.

