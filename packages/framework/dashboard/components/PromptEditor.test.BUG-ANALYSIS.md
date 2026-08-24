# Bug analysis: packages/framework/dashboard/components/PromptEditor.test.tsx

## Business logic (high-level)

Tests exactly the send-key seam (#1510) against the *real* Tiptap editor — deliberately unmocked,
since what is under test is `editorProps.handleKeyDown` wiring on the live contenteditable. Test
SPEC coverage: plain Enter sends; Shift+Enter and Alt+Enter do not; Ctrl+Enter and Cmd+Enter
send; Enter defers to an open suggestion menu (via the `aria-expanded` mark) and sends again when
it closes; Enter during IME composition never sends. All of those are pinned, each by a test that
fails if the guard regresses.

Fidelity notes:

- The suggestion-menu test sets `aria-expanded` on the editor DOM by hand rather than opening a
  real menu. That is white-box but honest: the production contract *is* the attribute
  (suggestion.ts documents that the Enter guard reads it, and its `draw`/`onExit` maintain it),
  and driving a real trigger menu through jsdom would test Tiptap more than the seam. The reverse
  flip back to `'false'` in the same test also pins that the guard re-enables sending.
- The IME test passes `isComposing: true` through the KeyboardEvent init — jsdom supports the
  flag, and the component reads `event.isComposing` off the native event, so the test exercises
  the real path.
- `renderEditor` awaits the textbox with `waitFor` because `immediatelyRender: false` mounts the
  contenteditable a tick late — without the wait every test would race the mount. Correctly
  awaited; the helper throws until the element exists, so no vacuous pass.
- `afterEach(cleanup)` unmounts, destroying the editor between tests.

Coverage gaps (noted, not test bugs): the code-block carve-out (Enter inside ``` block inserts a
line) is untested — it is also absent from the test SPEC's claim, so SPEC and tests agree; the
markdown/chips/mention behaviors live in other suites (Composer.test, tokenize tests).

## Functions (low-level)

### `renderEditor()`

Renders with minimal props (`projects={[]}`, `presets={[]}` — both required props supplied;
optional ones defaulted). Returns the contenteditable (`[role="textbox"]` — matches the
`editorProps.attributes` role) and the submit spy. The query is document-wide but only one editor
is mounted per test. Correct.

### "plain Enter submits; Shift+Enter and Alt+Enter do not"

Asserts 1 call after plain Enter, still 1 after Shift/Alt variants. Since `fireEvent.keyDown`
dispatches to the ProseMirror-attached listener, a regression in any of the three modifier checks
flips the count. Correct.

### "Cmd/Ctrl+Enter still submits"

Two events, expects 2 calls — covers both `metaKey` and `ctrlKey` branches of the one condition.
Correct.

### "Enter is left to an open suggestion menu (aria-expanded), which uses it to pick"

The title's "which uses it to pick" is not itself asserted (no menu exists here) — the test pins
only the editor-side deferral; the picking half lives in SuggestionList. The assertion pair
(no call while 'true', one call after 'false') is exactly the guard's contract. Correct.

### "Enter during IME composition is not a send"

Single event with `isComposing: true`, expects no call. Correct.

## Bugs found

None found.
