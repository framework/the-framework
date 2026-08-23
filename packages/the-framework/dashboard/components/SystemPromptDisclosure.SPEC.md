The "Enhanced System Prompt" disclosure on the agent launcher: it shows the user, in full, the system prompt The Framework wraps their own prompt in, and lets them switch the two things that shape it.

## User story

The user is about to start an agent and wants to know what The Framework actually sends on their behalf, rather than take the product's word for it — and wants to turn the wrapping off, in part or entirely, without leaving the launcher.

## Business logic — TL;DR

- **The real prompt, not a description of it** - the preview is composed the same way the agent composes it, so what the user reads is exactly what will be sent.
- **Two switches, not new settings** - the disclosure exposes the vanilla and transparent preferences under plain-language labels, writing the same preferences the session-options gear writes.
- **Transparent is the master off-switch** - with the framework integration off, the built-in block is off too regardless of the vanilla setting, and the row reads that way.
- **One dot for "fully on"** - the status dot next to the label is lit only when both switches are on.

## Business logic

### The real prompt, not a description of it

#### User story

See `## User story`.

#### Business logic

Opening the disclosure shows the whole system prompt as text, together with its character length and the statement that nothing further is appended when the session starts. The preview is composed live from everything that shapes the prompt: what the user has typed so far, the selected context, whether the browser preview section rides along, and the repo's own `SYSTEM.md` addition. Because the preview is produced by the same composition the agent uses, the two can never disagree.

When the composition yields nothing — the transparent case — the disclosure says so plainly: no extra system prompt, only the AI model provider's own built-in one.

### Two switches, not new settings

#### User story

See `## User story`.

#### Business logic

Two checkboxes sit above the preview:

- **Anti-laziness and improved large-scope planning** — on unless the agent runs vanilla.
- **Integration with The Framework**, marked as costing some functionality — on unless the agent runs transparent.

Both write the same preferences as the session-options gear, so both surfaces always describe the same agent. Neither can be changed while the launcher is busy. The integration checkbox reads as fixed wherever switching the integration is not the caller's to offer.

### Transparent is the master off-switch

#### User story

See `## User story`.

#### Business logic

With the framework integration off, the anti-laziness checkbox shows as off and cannot be changed; it carries the explanation that it is off while the framework integration is off. The status dot beside the "Enhanced System Prompt" label is lit only when both switches are on, and dim otherwise — including the case where only the built-in block is off, even though such an agent still sends the framework's protocols.

#### Rationale

The dot has to read the way the agent will actually behave, not the way the stored preferences read in isolation: turning the integration off silences the built-in block whatever the vanilla preference says.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
