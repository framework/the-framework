The three deliverables The Framework ships, one directory each:

- `framework/` — the product: the `framework` npm package (CLI, daemon, agent lifecycle, dashboard).
- `chrome-extension/` — the Claude web bridge, a companion Chrome extension that connects Claude Code cloud sessions on claude.ai back to the local dashboard.
- `the-framework.ai/` — the marketing website.

The product stands alone; the extension and the website depend on it only in what they present, not in code. See the root `SPEC.md` for how the three relate as a product.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
