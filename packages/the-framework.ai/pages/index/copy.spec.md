`useCopy()` — copy-to-clipboard hook with "copied!" badge timing tuned around text selection.

## TLDR

- Ignores the extra clicks of a double/triple click (`e.detail > 1`) and any click made while a text selection exists, so selecting a command never triggers a copy.
- `navigator.clipboard.writeText` with a hidden-textarea `document.execCommand('copy')` fallback (which itself may silently fail — the badge still gives feedback).
- Badge shows for 1.5s; if the user is mid-selection when it would clear, clearing is deferred another 2s so the flip doesn't distract during selection.
