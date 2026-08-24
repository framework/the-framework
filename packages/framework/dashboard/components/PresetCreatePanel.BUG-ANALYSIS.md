# Bug analysis: packages/framework/dashboard/components/PresetCreatePanel.tsx

## Business logic (high-level)

The "New preset" modal (#649/#626, tiers #1025): prompt field prefilled from the composer's
current text (captured once at mount — the "save what I just wrote" path; later composer edits
deliberately don't leak in), name capped at `LABEL_MAX` 80 via the input's `maxLength`, save
requires both trimmed-non-empty name and prompt (button disabled and `save()` double-guards),
scope choice "Just me"/"This project" shown only with `canSaveToProject` and defaulting to
`'user'`, Ctrl/Cmd+Enter saves (composer parity), Escape/backdrop closes via the Dialog's
`onOpenChange(false)` → `onCancel`.

Edge cases checked:

- Scope safety: `onSave(..., canSaveToProject ? scope : 'user')` — even if `scope` could somehow
  be `'project'` without the choice rendered (it cannot; the buttons are the only writers), the
  save is forced to the user tier. Matches the SPEC's "otherwise the preset is always saved as
  the user's own".
- Trimming: label and prompt are trimmed at save time (SPEC: whitespace ignored); the disabled
  condition uses the same trims, so the button state and `save()` cannot disagree.
- `newId()`: `crypto.randomUUID` with a `p-<Date.now()>` fallback guarded by a `typeof` check —
  never throws in a non-crypto environment (jsdom in tests included). Collision risk of the
  fallback is theoretical (two saves in one ms in a browser without randomUUID, which the
  comment notes doesn't ship).
- `busy`: disables both inputs, both scope buttons and Save. The Ctrl+Enter handler calls
  `save()` without checking `busy` — but while busy every focusable element inside the wrapper
  except Cancel is disabled, and a keydown can only reach the wrapper from a focused descendant;
  the parent flips `busy` on the first `onSave`, re-rendering before any humanly-possible second
  keystroke (auto-repeat included: React re-renders between native events). Recorded as a
  reliance on the parent setting `busy` synchronously, not a bug.
- Keyboard: `preventDefault` on the save chord stops the textarea inserting a newline; Escape is
  the Dialog's own behaviour so `onKeyDown` correctly doesn't reimplement it.

## Functions (low-level)

- `newId()`: above. Correct.
- `PresetCreatePanel({currentPrompt, busy, canSaveToProject, onSave, onCancel})`:
  - State: `label` (''), `prompt` (prop-initialised), `scope` ('user'). Correct.
  - `save()`: trim-guard then `onSave({id, label, prompt}, scope-or-user)`. Correct.
  - `onKeyDown`: chord detection `(meta || ctrl) && Enter`. Correct.
  - Render: Dialog (`open` always true — mounting is opening, the caller unmounts to close;
    `onOpenChange` only ever fires with false), name input (autoFocus, maxLength), textarea
    (resize-y, 5 rows), scope segmented control with `aria-pressed` and per-scope explainer
    text, Cancel (never disabled — you can always back out, even mid-busy) and Save (disabled by
    busy or emptiness). Correct.

## Bugs found

None found.
