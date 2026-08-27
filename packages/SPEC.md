The deliverables The Framework ships, one directory each:

- `framework/` — the product: the `framework` npm package (CLI, daemon, agent lifecycle, dashboard).
- `branch-management/` — the `@superskill/branch-management` npm package: the git conventions and operations behind an agent's own checkout, the first skill of the skills-plus architecture (#1725). The product depends on it; nothing else does yet.
- `chrome-extension/` — the Claude web bridge, a companion Chrome extension that connects Claude Code cloud sessions on claude.ai back to the local dashboard.
- `the-framework.ai/` — the marketing website.

The product depends on the branch-management package in code; the extension and the website depend on the product only in what they present. See the root `SPEC.md` for how the three relate as a product.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
