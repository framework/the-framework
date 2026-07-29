The code side of the await/signal protocols (#337/#339): the protocol constants injected into the system channel, and the parsers that detect what an agent turn's final text emitted — blocking await gates, non-blocking views, and lifecycle signals.

## TLDR

- Protocol constants (text lives in `prompts/protocols/*.md`, #551): `AWAIT_PROTOCOL` (how to emit an awaited choice), `SIGNAL_PROTOCOL` (setSessionName()/setReadyForMerge()), `BROWSER_PROTOCOL` (#824, prefer chrome-devtools over WebFetch), `HANDS_OFF_PROTOCOL` (#1234, gates taught then declared unavailable).
- Gate parsers, one per fenced-block tag: `await-choices` (#337, single-select with optional `recommended` by id or label), `await-multiselect` (#339), `await-confirmation` (#358, fixed Approve/Decline, optional `file`), `await-browser` (#796, human must *do* something — login wall/captcha; optional `url`), `await-bind-project` / `await-create-project` (#1121, topic runs).
- `parseAwaitGate()`: whichever gate the turn ended on — when several block kinds are present the latest in the text wins, and a malformed later block falls back to an earlier one; `undefined` = the agent just finished (the common case).
- Non-blocking signals: `parseMarkdownViews()` (#441, `show-markdown` blocks → side-panel views, id = title slug so re-shows update in place), `parseSessionName()` (last `set-session-name` block, slugified to the branch-name shape), `parseReadyForMerge()`.
- `createTurnSignalEmitter()`: emits a turn's signals with dedupe state held across the turns it covers — `ready-for-merge` fires once, a session name only re-emits on an actual rename; one emitter per span of turns (a build's await rounds, the whole backlog).
- `continuationPrompt()` + `MAX_AWAIT_ROUNDS` (5) + `isDeclinedConfirmation()`: the resume wording, ask-cap, and decline test every gated path shares.

## Problems

- The driver runs each agent turn as a black box to completion (#165), so a signal in the turn's final message is the only way the framework can learn the agent stopped to ask rather than deciding for itself — which is why the protocol pins *how* to emit, not *when* (the system prompt owns that).
- Every parser is tolerant by design: a malformed block yields `undefined` (or a fallback title) rather than throwing — a bad parse must never crash a build. Label-less options are dropped; ids are synthesized (`opt:<i>`) when the agent named none; non-string fields are dropped rather than shown as "undefined".

## Decisions

- `parseSessionName` tests emptiness directly rather than via a fallback sentinel: a sentinel made a session legitimately named `view` indistinguishable from no name at all (#939).
- `await-bind-project` carries only a title — the framework fills the project list from the registry at resolution time, so the agent never guesses which projects exist; an empty/malformed body still triggers the gate rather than being dropped.
- A create-project confirmation IS the permission grant (registering a path hands the app filesystem access), so its resolution recommends Approve like a plan confirmation.
- One `continuationPrompt` wording for every path (#570): the per-caller clause variants carried no distinct meaning; no "do not ask again" tail (babysitting left off until a run shows it is needed).
- `MAX_AWAIT_ROUNDS` is a property of the protocol, shared, because build / direct prompt / backlog loop each used to declare their own.

## Facts

- Answer constants: `CONFIRM_APPROVED`/`CONFIRM_DECLINED` = `Approve`/`Decline`; `BROWSER_HANDLED`/`BROWSER_NOT_HANDLED`; `CREATE_PROJECT_APPROVE` = `Register and bind` / `CREATE_PROJECT_DECLINE` = `Not now`; `NO_PROJECTS_TO_BIND` for a bind gate over an empty registry.
- Fenced-block grammar: last block of a tag wins within a turn; options gates require a JSON body with an `options` array; record gates (`confirmation`/`browser`/`create-project`) are a title plus one optional string field.
