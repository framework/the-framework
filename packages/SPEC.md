The deliverables The Framework ships, one directory each:

- `framework/` — the product: the `framework` npm package (CLI, daemon, agent lifecycle, dashboard).
- `skill-branches/` — the `@gemstack/skill-branches` npm package: the git conventions and operations behind an agent's own checkout, with the skill's instructions (`SKILL.md`) and the `branches` command an agent follows them with: the first skill of the skills-plus architecture (#1725). The product depends on it, and so does the skill-tickets package.
- `skill-tickets/` — the `@gemstack/skill-tickets` npm package: the project's tickets and its agent queue on the `tickets` branch of its own repository, with the skill's instructions (`SKILL.md`) and the `tickets` command an agent reads, writes and claims them with: the second skill of the skills-plus architecture (#1748). The product depends on it; it depends on skill-branches for the branch it keeps everything on.
- `agent-driver/` — the `agent-driver` npm package: the driver seam — start a coding-agent CLI in a directory, prompt it for one full turn, stream what it does, resume it later — with the Claude Code, Codex, GitHub Actions and fake implementations. The product depends on it and adds its own cloud-session implementation behind the same contract.
- `chrome-extension/` — the Claude web bridge, a companion Chrome extension that connects Claude Code cloud sessions on claude.ai back to the local dashboard.
- `the-framework.ai/` — the marketing website.

The product depends on the skill-branches, skill-tickets and agent-driver packages in code; the extension and the website depend on the product only in what they present. See the root `SPEC.md` for how they relate as a product.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
