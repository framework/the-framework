Effort: 1
Uncertainty: 2

# [Plan] Landing page: New feature "Headless browser"

Concrete proposal to add a "Headless browser" card to the landing page's Features section, with copy that stays accurate to what shipped.

## TLDR

Add a ninth card to the Features grid in `packages/the-framework.ai/pages/index/Features.tsx` and update the two SPEC summaries that mirror it. The feature is real and merged (browser phase 1, #466), so this is pure marketing copy — the only care points are wording accuracy (the feature is opt-in and Claude-driver-only today) and not colliding with The Framework's own Chrome extension (the claude.ai bridge, an unrelated thing).

## What exists today (grounding for the copy)

- Shipped (phase 1, #466): the agent gets its own headless Chromium (`--headless=new`, throwaway profile, `packages/framework/src/browser.ts`) driven through chrome-devtools-mcp — navigate, DOM, console, network, screenshots. Opt-in via the `browser` agent option (`packages/framework/src/cli.ts`, default `false`), wired through Claude Code's MCP config, so it has no effect on the Codex driver (a notice says so).
- On top of it: live MJPEG screencast of the agent's browser inline in the dashboard with clicks/typing/scrolling passed back (`BrowserPanel`, `browser-stream.ts`), and handing the browser to the human on a login wall / captcha / 2FA.
- Not shipped: browser inside sandboxed/container runs — that's phase 2 (#469, ticket `2026-07-14_browser-phase2-chromium-in-sandbox.md`), blocked.
- The landing page currently says nothing about any of this; `FEATURES-SPEC.md` already lists the product feature (under "Watching and steering an agent"), so no `FEATURES-SPEC.md` change is needed — this ticket only adds landing copy for an existing feature.

## Considerations

- **Placement — Features grid, as the ticket asks.** The grid is `repeat(auto-fit, minmax(300px, 1fr))`, so a ninth card needs no layout work. Alternatives considered and rejected: the "Autonomous AI" section (it argues what the product does *unasked*, not capabilities) and "Stop babysitting" (problem/bad-fix/solution triplets — wrong shape).
- **Card position within the grid.** Suggest after "Dashboard" (the screencast lives there) or simply appended before "Claude Code Web"; no strong signal either way — implementer's pick.
- **Honest wording.** The ticket's draft says "giving agents full seamless access". True for what it covers, but the feature is opt-in (`--browser`) and Claude-driver-only, and doesn't reach sandboxed runs yet. The card shouldn't enumerate caveats (no other card does), but it also shouldn't claim things phase 2 hasn't delivered — keep the claim to "launches a headless Chromium the agent fully controls", which is exactly true.
- **"No need for your AI browser extension anymore".** Keep the differentiator, but phrase it about extensions in general ("no browser extension needed"), not "your extension" — The Framework itself ships a Chrome extension (`packages/chrome-extension`, the claude.ai bridge for web runs), and copy implying "we have no extension" would read as false to anyone who meets that feature later.
- **Sell the differentiators the ticket doesn't mention.** The live screencast + human handoff are more distinctive than DOM access alone and are one sentence each; worth folding into the card text (or leaving to the Dashboard card — see suggested copy).
- **SDD.** `Features.SPEC.md` (TL;DR bullet list of the eight cards) and `pages/index/SPEC.md` (one-line Features summary) both mirror the card list and must be updated in the same change; read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md first, as both files instruct.

## Implementation

1. `packages/the-framework.ai/pages/index/Features.tsx`: add one card in the existing style. Suggested copy (final wording is the implementer's call, style-matched to the other cards):
   - Title: **Headless browser**
   - Text: "The Framework launches a headless Chromium that agents fully control — DOM, console, network, screenshots via Chrome MCP. No AI browser extension needed. Watch it live and take over on login walls."
2. `packages/the-framework.ai/pages/index/Features.SPEC.md`: grow the TL;DR to nine bullets ("eight cards" → "nine cards" in the intro line), adding e.g. "**Headless browser** - agents drive their own headless Chromium (DOM, console, network, screenshots via Chrome MCP); watchable live, hand-overable on login walls, no browser extension required."
3. `packages/the-framework.ai/pages/index/SPEC.md`: extend the **Features** summary line to name the browser alongside the other capabilities.
4. No `FEATURES-SPEC.md` change (landing copy isn't a product feature; the underlying feature is already listed).
5. Verify the grid still lays out sanely at mobile and desktop widths (auto-fit should handle it; a 9th card just wraps).
