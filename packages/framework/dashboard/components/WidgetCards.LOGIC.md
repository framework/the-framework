Draws on the Overview the cards the installed widgets [1] declare.

## Context

**User story**: a project depends on the queue package, so the Overview shows that package's queue card under the agents at work; a project with no such package sees no queue card at all, instead of an empty one saying "Nothing queued.".

## Glossary

[1] widget: a browser module one of a project's packages brings to the dashboard, named by the package's `exports["./dashboard"]`; it adds pages and Overview cards to the dashboard and reads its data through its own package's command.

## Business logic

Every card the shell mounted (`lib/use-widgets.ts`), in the order it mounted them (by the card's order, then its package), is rendered in its own slot (`WidgetPageView.tsx`): given the registered projects that have its package, by id and name, leaving out any the dashboard does not currently list; inside the host its `useWidgetHost()` reads, bound to its package; and inside a boundary, so a card that throws shows "The `<id>` card failed: `<reason>`" in its place and the other cards and the rest of the Overview keep working. No card declared: nothing is drawn.
