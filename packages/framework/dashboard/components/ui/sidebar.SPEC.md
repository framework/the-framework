The dashboard's collapsible side column and the page shell around it: a header, a scrolling body of labelled groups and menu entries, and a footer, sitting beside the main content area.

## Business logic — TL;DR

- **Collapsing, and remembering it** - the sidebar can be shown or hidden by its toggle button, by clicking the thin strip running down its outer edge, or by Cmd/Ctrl+B anywhere in the dashboard; the choice is remembered for a week and survives a reload.
- **Two ways to collapse** - a sidebar either slides fully off the side of the page, or shrinks to a narrow strip of icons; a third setting pins it open permanently.
- **Collapsed entries name themselves on hover** - once the sidebar has shrunk to icons, each entry shows a tooltip with its label to the right; when the sidebar is expanded, or on a narrow screen, those tooltips are suppressed because the label is already visible.
- **Narrow screens get a drawer** - below the dashboard's mobile breakpoint the sidebar is not a column at all: it slides in over the page as a drawer and closes again, with its own open state separate from the desktop one.
- **Menu entries** - an entry can be marked as the current one (highlighted and bolder), carry a count badge, and carry a secondary action button pinned to its right; that action can be set to appear only while the row is hovered or focused. Entries can nest one level into an indented sub-list. Badges, secondary actions, group labels, and sub-lists all disappear when the sidebar shrinks to icons, where there is no room for them.
- **Placeholder rows while a list loads** - a menu can show grey shimmer rows in place of entries; each row's width is derived from its own identity rather than re-rolled at random, so the placeholders do not twitch between renders.

## Business logic

### Collapsing, and remembering it

#### User story

The user works in one project for a long stretch and wants the whole window for the agent they are watching; later they want the navigation back. They expect the dashboard to still be the way they left it after a reload.

#### Business logic

The toggle button in the header, the thin strip along the sidebar's outer edge, and the Cmd/Ctrl+B shortcut all flip the same open/closed state. Every flip writes the new state into a browser cookie that lasts a week, so the next page load starts from the state the user last chose. On a narrow screen the same three controls flip the drawer instead, leaving the desktop state untouched.

### Two ways to collapse, and what survives each

#### User story

Some sidebars should vanish to give the content the full width; others should stay reachable as a strip of icons the user can still click.

#### Business logic

A sidebar collapses either off-canvas — the column slides out past the edge of the page and the main content takes over the space — or to icons, where it narrows to a strip that keeps each entry's icon clickable. In the icon strip everything that needs width is hidden: group labels, group actions, count badges, per-entry actions, and nested sub-lists. Each remaining entry gains a tooltip carrying its label, so the user can still tell the icons apart. A sidebar can also be declared non-collapsible, in which case it is simply always there.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
