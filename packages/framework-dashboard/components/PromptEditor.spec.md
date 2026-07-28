The rich Tiptap prompt composer (#470) replacing the plain textarea: `/` commands (presets + agent actions), `<` macro tags, `@` project and `#` file references — all as chips that serialize back to the exact prompt text the agent reads.

## TLDR

- Tiptap + StarterKit + `tiptap-markdown` (html:false, linkify:false, breaks:true, transformPastedText) + the custom `Token` node; four `makeTrigger` suggestion extensions (`/`, `<`, `@`, `#`) from `prompt-editor/`.
- Chips render as tokens but serialize to plain prompt text (`<AWAIT>`, `@name`, `#path`, action calls), so nothing downstream changes; markdown flows out via `onChange(ed.storage.markdown.getMarkdown())`; Cmd/Ctrl+Enter submits.
- `/` lists built-in presets (templates via `render()`), user + project saved presets (verbatim, hinted "saved preset"/"project preset", #626/#1025), "New preset…" (only with `onNewPreset` — the compact navbar launch passes none), and `ACTION_TOKENS`.
- `@`/`#` picks insert a chip and call `onMentionProject(path)` / `onMentionFile(relPath)` to focus the run Context (#504); `syncMentions` diffs the doc's chips on every update and fires `onMentionRemoved` when one leaves, so prompt and Context set cannot diverge (#948).
- Handle: `clear`, `focus`, `loadTemplate(text) → replaced`; `initialText` seeds one opening draft (#1066/#1139); `compact` is the one-line navbar variant (#723); height caps via ScrollArea (#1046, resting height deliberately short #756).

## Problems

- `immediatelyRender: false` leaves `editor` null on first render, so a mount-time `loadTemplate` call silently no-ops — a caller that had already taken its one-shot draft lost it. Hence `initialText` as a prop, applied exactly once (a `seeded` ref, so seeding causes no render) when the editor exists.
- The suggestion closures are built once on first render, before `useEditor` resolves: every prop they need lives in a ref (`projectsRef` etc.), and `applyTemplate`/`loadTemplateInto` take the live editor as an argument rather than capturing one.
- `setContent` emits no update event, so `loadTemplateInto` must itself sync the empty flag, the outgoing markdown, and the mention chips.

## Decisions

- Loading a preset over a typed draft asks no blocking confirm (#948): the replacement is one undo step (history groups the draft after its ~500ms window), and `onPreset(label, replaced, newSession)` lets the form's note say undo brings it back.
- `breaks: true` keeps a single newline a hard break so a preset's line-per-line definition block (REVIEW_FILE:/TODO_FILE:…) survives the markdown round-trip instead of collapsing into one paragraph.
- The `/query` trigger range is deleted before loading, so it neither counts as a replaced draft nor leaks into the prompt "New preset…" captures.
- A project chip carries the project *name* while the Context holds its *path*; removal maps name back to path via the projects list.
- Explicit textbox ARIA (`role="textbox"`, `aria-multiline`, `aria-label`, `aria-placeholder`) because a bare contenteditable is an unlabeled editable region (#948); the visual placeholder is absolutely positioned and must share the editor's padding to sit exactly where the first typed character will (#721).
- `<` opens the macro menu but a stray `<` in prose is not a trap: the suggestion ends on a space and the menu hides when nothing matches.

## Facts

- `PresetEntry` is imported from `PresetsMenu.js`: the `/` menu and the Presets button are two faces of one list.
- The height cap must sit on the ScrollArea *viewport*, not the Root — a Root max-h cannot be resolved by the viewport's height, so the editor would grow instead of scrolling.
- Compact keeps its own border+ring; the full composer's border lives on the surrounding composer box (#721) so editor and controls read as one surface.
