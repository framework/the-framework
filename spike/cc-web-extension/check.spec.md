Offline harness that runs `content.js` inside jsdom against synthetic pages — no browser, no live session — proving the question extraction, answer delivery, and panel-collapse behaviors (14 cases, exit 1 on any failure).

## TLDR

- 10 extraction cases, including the four that broke real sessions: `<code>` with no `<pre>`, content behind an open shadow root, a 4-space indentation, and the system-prompt spec as a decoy (spec-then-real must pick the real question; spec alone must find nothing); also a highlighter splitting the block across spans, prose around it, and a no-question page.
- 3 delivery cases via `window.__tfBridgeDeliverAnswer`: fill + click of the `aria-label="Send message"` button, Enter fallback when no button exists, and honest refusal on a composer-less page (wait shortened via `window.__tfComposerWaitMs`).
- 1 collapse case: the panel folds to its title bar (the toggle is the one button with `aria-expanded`) and restores with rows intact.
- Assertions read the injected panel's text — the panel is appended to `documentElement`, not `body`.

## Facts

- jsdom is resolved through `packages/framework-dashboard` via `createRequire`, because this directory is deliberately outside the workspace globs.
- Spec fixtures are HTML-escaped before going through `innerHTML` — `<the question>` would otherwise parse as a tag and vanish from `textContent` (the real page escapes it too).
- jsdom has no `execCommand`, so delivery cases exercise the fallback fill; what they prove is the flow around it (composer found, button preferred, Enter fallback, refusal).
- What this cannot prove is the one thing left: whether claude.ai's real DOM puts the block somewhere these strategies reach — that is what loading the extension answers.
