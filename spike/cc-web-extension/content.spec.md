Content-script half of the Claude web bridge (#1237): finds the question a cloud session is parked on and the session transcript in the claude.ai page, hands both to the service worker, types delivered answers into the composer, and renders a diagnostics panel.

## TLDR

- Extraction: brace-matches every JSON object carrying `"options"` out of `pre code, pre, code` elements — including open shadow roots via `deepQueryAll` — falling back to deep page text for blocks split across elements; the LAST non-template match wins (spec first, real question after).
- `isTemplate()` filters the decoy: the page renders our own system prompt, so its await-choices spec (all-placeholder `<...>` values) appears as a JSON block before any real question.
- Transcript: one block per `article` element (composer-only articles skipped); with no articles, mirrors the conversation container (`main`/`[role=main]` preferred over `body`, icon-font glyphs `-` stripped) as one block sliced from the END; only changed blocks re-post (`sentEvents` by seq).
- Answer delivery (top frame only): waits up to 20s for a composer, fills contenteditable via `execCommand('insertText')` with a `textContent` + `InputEvent` fallback (or sets `textarea.value`), settles 400ms, clicks the LAST enabled `aria-label~=send` button, else dispatches Enter keydown/keyup.
- Panel: fixed bottom-right in the top frame; rows for question/composer/bridge/answer/transcript status + failure diagnostics; collapsible (fold stored in `chrome.storage`, restored async); "Copy report" and "Fill composer (does not send)" buttons.
- Child frames run the same survey and `postMessage` findings up to the top frame — a child-frame find means the content lives in an iframe, which is the finding.
- `watch()`: MutationObserver (debounced 250ms) plus a slow interval backstop (60s); an `alive()` guard disconnects both once the extension context dies.

## Problems

- Four spike rounds shaped the extraction, each a distinct obstacle: (1) the page has `<code>` with no `<pre>`, so a `pre code` selector examined nothing; (2) message bodies sit behind shadow roots, invisible to `document.body.innerText`; (3) fixed prefixes (`{"title"`) guessed an indentation nobody promised — replaced by brace matching with string/escape tracking so a brace inside a label can't close the object early; (4) the rendered system prompt is a decoy whose spec block round 3 reported as the question.
- Chrome clamps timers in tabs hidden >~5 min to ~once/min, and this runs in background tabs — hence MutationObserver, not fast polling.
- Reloading the extension orphans injected scripts (every `chrome.*` call throws); `alive()` stops watching instead of erroring once a minute forever onto the extension's error page.
- The first live delivery landed right after a tab revive when claude.ai takes well over 5s to render — so "no composer" mostly means "not yet"; hence the 20s wait (`window.__tfComposerWaitMs` shortens it for the harness).

## Decisions

- Token and fetch live in the worker, never here: the script shares a tab with claude.ai, and a content-script fetch would carry the page's origin into a CORS check the daemon refuses on purpose.
- Transcript falls back to a single whole-page block rather than a heuristic split — a wrong split would post gibberish that looks like output; sliced from the END because a head slice sent 8000 chars of rendered system prompt.
- The panel is hidden during `pageText()` so the mirror never mirrors itself; the scrape excludes `PANEL_ID`.
- `diagnostics()` reports structure and lengths only, never message text, so a report is safe to paste into a public issue; the decisive pair is `"options"` in body text vs deep text.
- Statuses (`bridgeStatus`/`transcriptStatus`/`answerStatus`) exist because silent failure was the first live bug: the worker answered "no token set" and nobody ever saw it.
- Answers are handled by the top frame only (composer lives there; a child answering too would double-submit); `deliverAnswer` is exposed as `window.__tfBridgeDeliverAnswer` only when `chrome` is undefined (jsdom harness), never on a real page.
- Panel fold is stored in `chrome.storage`, not page `localStorage`: the preference should survive reloads and nothing the extension keeps should be readable by the watched page; collapsing hides the detail, not the bridge — the survey still runs.

## Facts

- Session id parsed from the URL: `/code/(session_[A-Za-z0-9]+)`; questions capped at title 500 chars / 20 options / detail 500 chars; transcript blocks capped at 8000 chars.
- Messages to the worker: `tf-question`, `tf-events`, `tf-hello` (version + scrape summary, so diagnosis doesn't need a panel screenshot); from the worker: `tf-deliver-answer`.
- `check.mjs` runs this file in jsdom (all `chrome.*` access is guarded), covering all four extraction failures offline.

## Flows

- survey loop: mutation/interval → `survey()` → `findPendingChoice()` (elements → deep text, template-filtered) → `reportToDaemon(tf-question)` + `reportTranscript()` (tf-hello, then changed blocks as tf-events) → panel `render()`.
- answer: worker `tf-deliver-answer` → `deliverAnswer(text)` → wait for composer → fill → click send | Enter fallback → `{ok, note}` reply → worker acks the daemon.
- child frame: `survey()` → `postMessage({__tfBridge})` to top → top panel shows the frame's find as the winner.
