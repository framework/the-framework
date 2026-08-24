# Bug analysis: packages/framework/dashboard/components/prompt-editor/tokenize.ts

## Business logic (high-level)

Converts plain token strings already sitting in the editor doc (typically right after a preset was
loaded via `setContent`) into token chips, so a loaded preset looks like an assembled one. The
SPEC (tokenize.SPEC.md) additionally promises that text inside an *inline code span* is left
alone (`path/<SESSION_NAME>.md` stays one verbatim code span).

Mechanics audit:

- Single pass over `doc.descendants`, collecting matches with absolute positions (`pos + m.index`),
  then one transaction applying replacements **back-to-front** (`matches.reverse()`), so earlier
  offsets stay valid. Since `descendants` yields document order, the reverse gives strictly
  descending positions — correct; each `replaceWith` only shifts positions after itself.
- `TOKEN_PATTERN` matches cannot overlap, and `matchAll` on each text node is position-correct for
  multi-node paragraphs (`pos` is the text node's own start).
- The inline-code guard checks `node.marks.some(mark => mark.type.name === 'code')` — that covers
  the `code` **mark** only. Fenced/indented code **blocks** (StarterKit's `codeBlock`, which
  PromptEditor installs, and which `tiptap-markdown` produces for ``` fences in a loaded preset)
  carry no `code` mark on their text; their content is matched and replaced. See bug 1.
- `if (!tokenType) return` — schema without the Token node (never in this app) no-ops. Fine.

## Functions (low-level)

- `tokenizeEditorDoc(editor)` — the only export.
  - Inputs: live editor. Output: dispatches one transaction (or none when no matches).
  - Edge cases: empty doc → no matches → no dispatch (no empty-step churn). Multiple matches in
    one text node → all collected, replaced back-to-front. Tokens split across adjacent text nodes
    (different marks) cannot match — by design, since a mark boundary means the user styled half a
    token; acceptable.
  - Verdict: bug found (code blocks, below).

## Bugs found

1. `L16`: **Token strings inside code *blocks* are "chipified", which splits the code block and
   corrupts the loaded content.** The guard skips only the inline `code` mark; a fenced block in a
   preset (` ```\nrun <AWAIT> now\n``` ` or any block containing `<UPPERCASE>` / `showX()` text —
   e.g. a user-saved or project-shared preset with an example snippet) produces a `codeBlock` node
   whose text matches `TOKEN_PATTERN`. `codeBlock` content is `text*` (no inline atoms), and
   ProseMirror's replace fitter does not throw — it **splits the block**: probed against the
   repo's own prosemirror-model/transform, `doc(codeBlock("before <AWAIT> after"))` becomes
   `doc(codeBlock("before "), paragraph(token, " after"))`. So loading such a preset silently
   tears the fence apart, moves the tail into a normal paragraph, and the serialized prompt no
   longer matches the preset text — violating both the tokenize SPEC's leave-code-verbatim intent
   and the directory SPEC's chip guarantee ("the prompt the agent receives is the same as if the
   user had typed it out"). Reachable: users can type a code block in the editor (input rules are
   disabled inside it, so token text stays plain), save it as a preset, and reload it; project
   presets are arbitrary repo markdown. Severity: major. Fix sketch: use the `parent` argument of
   `descendants((node, pos, parent) => …)` and also skip when `parent?.type.spec.code` (or
   `parent.type.name === 'codeBlock'`), mirroring the inline-code guard.

