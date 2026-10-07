What the tests cover:

- **A page claims the segment** - `tickets/2026-01-01_x.md` opens the mounted page `tickets` with `[projectId, '2026-01-01_x.md']` as its path, and a longer path keeps its rest (`…/plan`).
- **Nothing opens** - when no mounted page carries the first segment, for an absolute URL, for a bare file with no segment before it, for a leading slash, and for a first segment that is not a page word (a capital letter).
- **Splitting a path** - the first segment and the rest are split apart; a segment with nothing after it names no page.
