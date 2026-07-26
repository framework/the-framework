Status: open
Priority: 8
Topics: [bug, the-framework]
GitHub: [#1234](https://github.com/gemstack-land/the-framework/issues/1234)

# A Claude web run deadlocks on any ambiguous prompt: we tell it to await a human who cannot answer

## TLDR

Send an ambiguous prompt (e.g. `hi`) to a `Run on: Claude web` run: our own system prompt tells the agent to show choices and AWAIT, it obeys, and the session parks forever on a question nobody can answer — no read-back, no way to send a second message into a cloud session. The session is spent, nothing was built, the dashboard can't show the question. Proposed fix: `composeRunSystem` adds a block (keyed off `Driver.handsOff` from #1231) telling a hand-off run the await gates *are not available in this session*, so it picks the most plausible reading, states its assumption, and carries on — worded as availability, not as a rule, so it deletes itself once choices become a real capability. Maintainer verdict: acceptable as a stopgap only — it's "a hack with a no-go UX" long-term; CC web shouldn't limit TF, so the clean solution (driver reading CC web output — see #1237's session-API/bridge findings) is the real target.

## Why it matters

Every ambiguous prompt sent to the CC web target burns a cloud session for nothing, by design. The stopgap unblocks the target today; the wording choice (availability vs instruction) decides how cleanly it is later replaced by real capabilities (which cut against the #165 read-outcomes-only guardrail and need a blocking/non-blocking story for `showChoices`/`recommended`/autopilot).

## Source

Imported from GitHub issue [gemstack-land/the-framework#1234](https://github.com/gemstack-land/the-framework/issues/1234), created 2026-07-26, labels: `bug`, `priority: high`, `the-framework ♻️`, 2 comments.

### Original description

Send `hi` to a run with `Run on: Claude web`. The session starts, decides the prompt is ambiguous, asks a question, and stops forever:

```json
{
  "title": "What would you like me to do?",
  "options": [
    { "label": "Work on the next TODO" },
    { "label": "Tell you about current state" },
    { "label": "I'll tell you what to do" }
  ],
  "recommended": "Work on the next TODO"
}
```

Nobody can answer it. The session is spent, nothing was built, and the dashboard cannot show the question.

## Why

Our own prompt tells it to:

> Ambiguous prompt: make a list of interpretations sorted by plausibility, `<SHOW_CHOICES>`, `<AWAIT>`

It obeyed. But a cloud session cannot be answered, and that is structural:

- **Nothing we can use reads it back.** `claude agents --json --all` lists local background agents only, and a `session_01...` id is not among them. A private session API does exist (see #1237 for the endpoints), but it is undocumented and authenticates with the user's subscription credential, so it is not something this fix can lean on.
- **Nothing we can use writes to it.** `--cloud` starts a session; no CLI flag sends another message to one, and `--teleport` is interactive only (silently ignored under `-p`, see #1237).

So every ambiguous prompt sent to this target deadlocks by design, and burns a cloud session for nothing.

## Fix

Tell a hand-off run that the await gates are not available in this session, so it picks the most plausible reading, says which assumption it made, and carries on.

`composeRunSystem` already composes optional blocks around `AWAIT_PROTOCOL` (the browser protocol, the topic bind). Add one keyed off `Driver.handsOff` from #1231. `prompts/system_prompt.md` stays untouched, so the #326 byte guard is unaffected.

Open question: should the same block cover the plan approval and alternatives gates too? They await for the same reason.

## Word it as availability, not as a rule

The better long term shape is capabilities rather than instructions: let the prompt say "show the choices to the user" and let the agent reach for a real capability, instead of spelling out a protocol it has to follow. Availability then becomes a property of the session, and a cloud session simply is not handed that capability. It cannot park on a gate it was never offered.

That is a separate piece of work, but it decides the wording here. Phrase this block as "these gates are not available in this session" rather than "do not await, do X instead". Availability is the true statement either way, and it deletes itself cleanly once choices become a real capability.

Two things that will bite whoever builds the capability version:

- It cuts against the #165 guardrail that we read outcomes and never the agent's individual tool calls, so the likely shape is an MCP server, like the browser one.
- Blocking versus non blocking has to live somewhere: `showMarkdown` keeps going, `showChoices` stops the turn, and `recommended` drives the autopilot countdown.

## Related

#1225 and #1231 (the inverse: choices this machine invented about work that had left), #1235 (answering a cloud question by pulling the session local), #610.

### Notes from the GitHub thread

- Maintainer: "The fix isn't a fix, it's a hack with a no-go UX. We can use that hack for now, but: is there a clean & easy solution? Can the driver read the CC web output?" and "Long term, CC web shouldn't limit TF. That's a no-go UX (long-term)."
- A separate PR for this exists: #1250 (per the #1237 thread).
