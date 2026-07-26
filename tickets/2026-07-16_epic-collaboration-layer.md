Priority: 2
Topics: [the-framework]
GitHub: [#606](https://github.com/gemstack-land/the-framework/issues/606)

# Epic: Collaboration layer — agents as teammates in the comms layer

## TLDR

Agents get real identities and presence in the company's communication layer (chat, threads, later voice/video) as peers: add an agent to a channel, `@mention` it, DM it; a manager agent coordinates specialist agents and maintains the knowledge base, tasks, and issues. Direction: one generic integration seam (Slack/Discord/others all easy), a single bot user channeling multiple personas, realtime via Telefunc Room API, and an agentic-PM entry point (`/plan-from-chat` turns a discussion into a plan/queue). Tracked-but-later (Phase 1): do not build before the MVP ships.

## Why it matters

This is the "agents as teammates, not a sidebar assistant" step that sits on top of the autonomous core — the extension direction for the whole product. Open questions recorded: mapping per-user TODO/state when one bot serves many humans, voice/video (hosted-only, WebRTC infra), and compete-vs-collaborate with the main competitor. Depends on #605 for where agents run; rides on #454's source-of-truth substrate; maintains #462's tickets from chat.

## Source

Imported from GitHub issue [gemstack-land/the-framework#606](https://github.com/gemstack-land/the-framework/issues/606), created 2026-07-16, labels: `priority: low`, `the-framework ♻️`.

### Original description

> Tracked-but-later (**Phase 1**). Do not build before the MVP ships. This captures a team-discussion direction so it is not lost; it is not scheduled work yet.

## Vision

Agents get real identities and presence and live in the company's communication layer (chat, threads, later voice/video) as peers, not as a passive sidebar assistant. You add an agent to a channel, `@mention` it, or DM it. A manager agent reads a channel, DMs specialist agents, they coordinate, reply in-channel, and maintain the knowledge base, tasks, and issues. This is the "then extend in this direction" step that sits on top of the autonomous core, not instead of it.

## Decided direction

- Keep the integration seam simple and generic so Slack / Discord / others are all easy to add. Start with a single bot user that acts as a channel for multiple agent personas (no per-persona accounts needed).
- Realtime via Telefunc (Room API).
- Agentic-PM entry point: a team chats to consensus, then `/plan-from-chat` (or "@ai create a plan from this chat") turns the discussion into a plan/queue. Nudge the agent to be succinct.

## Open questions

- Multi-user chat mapping: how per-user TODO/state maps when one bot user serves many humans.
- Voice/video participation (hosted-only, needs webrtc infra).
- Compete vs collaborate with the main competitor (affects how much of this we build ourselves).

## Related

- Depends on #605 (daemon + gateway split) for where the agents actually run.
- #454 (syncing UI <-> data): the realtime / source-of-truth substrate this rides on.
- #462 (ticketing / PM): the tasks and issues agents maintain from chat.
