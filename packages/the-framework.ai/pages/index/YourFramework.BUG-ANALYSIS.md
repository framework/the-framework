# Bug analysis: packages/the-framework.ai/pages/index/YourFramework.tsx

## Business logic (high-level)

The trust argument, in three cards, under the heading "*Your* framework" with the sub "It isn't our framework. It's yours." Contents versus `YourFramework.SPEC.md`:

- **Flexible** — nothing is forced, pick only the features you need; plus "Customize anything to fit your needs" marked *Coming soon*. The SPEC explicitly requires that one item to carry the marker, and it is the only `WipBadge` on the landing page — so the site's "does not ship yet" convention is used exactly where the SPEC asks.
- **100% Local** — runs locally like a desktop app; no backdoors, no tracking; memory in the user's own Git repository at `knowledge-base/*.md`; data fully yours.
- **100% Open Source** — transparent, no hidden code; ask your favourite AI to open a PR, agentic contributions welcome.

All four/two/two bullets match the SPEC's prose and order. `id="your-framework"` is the last of `SectionNav.SECTIONS`, so this section is a spy target; it uses the shared `sectionStyle`, so anchor clicks land on the heading. Static content: no state, effects, timers or user input.

The heading is passed to `SectionHead` as JSX (accent-colored "Your" + " framework"), which is why `SectionHead`'s `title` prop is typed `ReactNode` rather than `string`; the same italic/accent treatment appears in `SectionNav`'s link via its `italicFirst` flag — the two are maintained separately and could drift in styling, but both render the same words.

`knowledge-base/*.md` goes through `CodeChip` (`overflowWrap: 'anywhere'`, bordered so it stays visible on the card background). The grid is `repeat(auto-fit, minmax(min(260px, 100%), 1fr))`, so the three cards collapse to one column on narrow viewports without overflow.

## Functions (low-level)

- **`Card({ title, children })`** — card shell with an `<h3>` and a `<ul>`. `children` is always a sequence of `Item` elements, i.e. `<li>`s, so the list markup is valid. `listStyle: 'none'` with `padding: 0` removes the default bullets/indent since `Item` draws its own marker. Verdict: correct.
- **`Item({ children, marker })`** — a flex `<li>` whose marker span is `flex: 'none'; width: 18`, so every row's text (including wrapped lines) starts in the same column — the comment states this and the fixed width delivers it. `marker ?? '✓'` means an explicitly passed `null`/`undefined` marker falls back to the check; the only override passes the `🚧` emoji. Verdict: correct.
- **`YourFramework()`** — the section. The one interesting composition is the Flexible card's second item: `marker={<Emoji e="🚧" />}` supplies the construction emoji as the row marker while `<WipBadge icon={false} />` renders the "Coming soon" pill without repeating that emoji inline — the `icon` prop exists precisely for this, and passing `false` here is what prevents a doubled 🚧. The 100% Local card's third item wraps its content in an extra `<span>` (unnecessary — `Item` already wraps children in one — but harmless). Edge cases: none reachable; no props, no data, no branches. Verdict: correct.

## Bugs found

None found.
