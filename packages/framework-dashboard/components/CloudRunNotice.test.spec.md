Tests for `CloudRunNotice.tsx` — covers the notice, the bridge question/answer loop (#1237), and the mirror row (#1265).

## TLDR

- Notice (#610): "Starting…" before the hand-off, session link + teleport command after, "opens its own PR" and "asks its questions over there" copy (#1225), nothing for other targets.
- Question (#1237): rendered once the bridge reports one, asked for by the cloud session id parsed from the hand-off event, never polled before the hand-off; link out kept as the manual path.
- Answering: pick must be confirmed before `sendBridgeAnswer`; queued shows as in-flight and cancellable (question card yields so picks cannot race); sent reads as answered; failed re-offers the question with the note.
- Mirror (#1265): ordered blocks in one labelled box, connecting placeholder, chrome lines scrubbed, renders nothing pre-hand-off/off-target; the notice pane no longer carries the transcript.
- `scrubMirrorText`: per-line anchoring, hole collapsing, all-chrome blocks scrub to empty.

## Facts

- Telefunc modules are mocked because an unmocked telefunc import dies in the browser test environment with `assertIsNotBrowser` — which reads as a telefunc bug and is not.
