Tests for `AiQueue.tsx` — covers the three entry renderings and the play-button start path.

## TLDR

- Ticket entries read as their title and open their ticket page with the bare filename slug (#1144); external links are real `<a target="_blank">`; plain entries stay spans.
- Play starts an unattended run (`unattended: true`, #1279) with `workOnEntryPrompt` of the exact clicked entry (asserted on the second row, proving it is not the first), then `onRunStarted` with the run id — or `undefined` for the adopt fallback (#1191).
- A failed start neither navigates nor hides the error; a busy start disables every play button; done entries and all-done projects are hidden; loading ≠ empty.

## Facts

- Only mocks are `use-start-run.js` and `preferences.js` — the queue itself arrives as a prop.
