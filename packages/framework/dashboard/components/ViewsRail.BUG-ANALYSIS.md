# Bug analysis: packages/framework/dashboard/components/ViewsRail.tsx

## Business logic (high-level)

The agent-views rail (#441): renders the markdown documents the agent pushed via `showMarkdown`
(derived upstream by `agentViews` — one entry per id, updated in place, first-seen order), with a
sticky title strip when there is more than one, a copy button per view, and the #948 rule that a
newly pushed view selects itself while a re-shown one updates without stealing the selection.

Against `ViewsRail.SPEC.md`:

- **Live updates in place** — the component renders `views[...]` fresh each render; in-place
  updates flow through without touching `active` (the id is already in `known`). Correct.
- **A new view selects itself** — `known` ref of seen ids; the effect selects
  `findIndex(v => !known.has(v.id))` — the *first* unseen. For the common single-append this is the
  new (last) view. When several land in one render batch (one turn can push multiple views), the
  first of the batch is selected, not the newest — either satisfies "switches to a view the user
  has not seen yet"; noted, not a bug. On first mount everything is unseen → selects index 0, the
  default — harmless.
- **Strip only when needed** — `views.length > 1`. Correct.
- **Copyable** — `CopyButton text={current.markdown}` (the body; the title is split out upstream by
  `parseMarkdownViews`, so the "view's markdown" is exactly this). Correct.
- **Nothing yet / vanishing views** — empty → "No views yet."; `current` clamps `active` into
  range so a shrunken list still shows a real view. In practice a shrink only happens across an
  agent switch, and the stream reset empties `views` first, unmounting the rail (RightRail swaps in
  DocsPanel when `hasViews` is false) and clearing `known`/`active` — so the clamp, and the
  no-tab-highlighted state it would leave (`i === active` matches nothing while `active` is out of
  range), are defensive rather than live paths. Noted as reliance on the stream clearing between
  agents.

Cross-agent id recycling: view ids are title slugs (`slugify(title)`), so two agents both pushing
"# Plan" produce the same id. The `known` ref would then suppress the auto-select for the second
agent's plan — but the empty-views interlude between agents remounts the component (above), so the
set starts fresh. Same reliance as the clamp.

## Functions (low-level)

- **`ViewsRail({ views })`** — the only export.
  - `known` effect: adds all current ids each run; never prunes (bounded by distinct titles per
    mount — trivial). Correct.
  - `current` clamp: `views[Math.min(active, views.length - 1)]`, `undefined` only when empty
    (Math.min with -1 indexes `views[-1]`). Correct.
  - Strip buttons: keyed by id, `title` attr for truncated labels, active highlight. Correct.
  - `scroller = useRef(...)` passed as `ScrollArea`'s `viewportRef` — **never read**: nothing
    resets or reads the scroll position. See bug 1.
  - Early return after all hooks — stable hook order. Correct.

## Bugs found

1. `L30`/`L53` (suspicious-but-unproven against the written spec, reported for the orchestrator to
   judge): switching views — including the #948 auto-select of a freshly pushed view — keeps the
   previous view's scroll offset, so a new view can open scrolled to the middle or past its end.
   Scenario: the user reads a long plan scrolled far down; the agent pushes a short summary; the
   rail auto-selects it, but the viewport keeps the old offset and shows blank space / the tail
   instead of the summary's top — undercutting the very "a view landing while you read another is
   not missed" behavior. The dead `scroller` ref (created and threaded into `viewportRef`, never
   read — `ui/scroll-area.tsx` documents that prop as "for a rail that scrolls itself
   (ViewsRail)") reads as the wiring for exactly the missing
   `useEffect(() => scroller.current?.scrollTo({ top: 0 }), [active])`. Severity: minor.
   Confidence: low (no spec sentence mandates the reset; the unused ref is the evidence of intent).
   Fix sketch: add the effect above (or drop the dead ref if the current behavior is wanted).
