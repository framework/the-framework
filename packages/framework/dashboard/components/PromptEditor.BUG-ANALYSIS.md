# Bug analysis: packages/framework/dashboard/components/PromptEditor.tsx

## Business logic (high-level)

The rich Tiptap prompt editor (#470): four typed triggers (`/` commands, `<` macro tags, `@`
projects, `#` files), chips that serialize to exact plain text, preset loading in place with a
`replaced` report, mention-is-focus context syncing (#948), Enter-sends key bindings (#1510),
grow-to-cap sizing, and a one-shot `initialText` seed (#1066/#1139).

### Trigger menus (SPEC "Four typed triggers")

- `/`: built-ins (label `/id`, hint = label, optional `title` tooltip), then user presets
  ("saved preset"), then project presets ("project preset"), then "New preset…" (only when
  `onNewPreset` exists — the compact navbar passes none, so the item is absent, per SPEC), then
  the agent actions. Order matches SPEC exactly. Query matching: `makeTrigger` lowercases the
  query before calling `items`, so `p.id.includes(query)` and the `.toLowerCase()` comparisons are
  all effectively case-insensitive (the extra `query.toLowerCase()` in the `#` filter is
  redundant but harmless).
- `<`: filters `MACRO_TOKENS` by lowercased label; a non-matching query hides the menu
  (suggestion.ts's `draw`), so a stray `<` in prose is not a trap. Matches SPEC.
- `@`: projects, `.slice(0, 8)`, `emptyNote` "No projects to reference yet." Matches SPEC ("at
  most eight", "with none registered the menu says so").
- `#`: files, `.slice(0, 8)`, `emptyNote` "No files indexed here yet." Matches SPEC.

All trigger closures read through refs (`projectsRef` etc.) refreshed by an every-render effect,
because the extension closures are built once — before `useEditor` even resolves. Correct pattern;
no stale-prop hazard.

### Chips mean plain text

`insertToken` inserts a `token` node (attrs kind/label/text) plus a trailing space — SPEC's
"picking anything else inserts a chip followed by a space". Serialization to the exact `text` is
the Token node's job (tokens.ts); loading a preset chip-ifies via `tokenizeEditorDoc`, which only
matches `<MACRO>`/`showX()` patterns — so project/file chips can only ever come from the pickers
(relevant to the mention-sync analysis below).

### Mentioning is focusing (#948)

Additions: the `@`/`#` `onSelect` handlers call `onMentionProject(project.path)` /
`onMentionFile(rel)` after inserting the chip. Removals: `syncMentions` runs on every doc update
(and manually after `setContent`/`clearContent`, which do not emit updates — correctly
compensated in `loadTemplateInto` and `clear`), diffs the current chip texts against
`mentionsRef`, and fires `onMentionRemoved` for each disappeared chip: `#`-chips report
`text.slice(1)` (the repo-relative path — exactly what `onMentionFile` added), `@`-chips look the
project up by name to recover its path (the chip carries the display name, the context holds the
path).

Problems found here:

1. **Reappearing chips never re-add the focus.** `syncMentions` only iterates the *old* set
   looking for disappearances; chips that *appear* without going through a picker are ignored
   (the comment says "additions are handled by the pickers' own callbacks" — but pickers are not
   the only way a chip appears). Concrete: pick `#src/a.ts` (context gains it), Ctrl+Z (chip
   gone, sync removes the focus — correct), Ctrl+Shift+Z (chip back, no callback — context does
   NOT regain it). Same after undoing a preset load that had wiped mention chips: the chips
   return, their focus does not. The prompt now shows a `#src/a.ts` chip while the Context list
   lacks it — precisely the disagreement the SPEC rules out ("deleting that chip takes it back
   out, so the prompt and the Context list can never disagree"; rationale: a chip is the visible
   sign of the focus). Minor severity (needs undo/redo), but a direct invariant violation.
2. **Project-chip removal resolves by display name, which is not unique.** `ProjectSummary.name`
   is documented as "the path's basename" (src/dashboard/projects.ts) — two registered checkouts
   `~/work/app` and `~/personal/app` both have name `app`. Both render as identical `@app` items,
   and both insert chip text `@app`. Consequences: (a) deleting the chip runs
   `projects.find(p => p.name === 'app')`, which returns the *first* project of that name — if the
   user mentioned the second, `onMentionRemoved` fires with the wrong path, leaving the real
   focus stuck in the context (the exact "silently carried focus" the SPEC calls a lie) while
   attempting to remove a path that was never added; (b) with one chip per same-named project in
   the doc, the `Set<string>` collapses both to one entry, so deleting one of them removes
   nothing. Fix direction: carry the project path in the token attrs (the node already has an
   attrs bag) and diff on that, instead of round-tripping through the display name.

### Presets load in place

`/`-menu preset pick: deletes the `/query` trigger range first (so the trigger text does not
count as a draft), then `loadTemplateInto` → `replaced = !ed.isEmpty` before `setContent`;
reports `onPreset(label, replaced, preset.newAgent)` for built-ins and 2-arg (no `newAgent`) for
custom/project presets — SPEC's "a custom preset is always a plain load" holds. No blocking
confirm; history's ~500ms grouping makes the replacement a separate undo step in practice.
The imperative `loadTemplate` (Presets button path) shares `loadTemplateInto`, so both faces
behave identically. Correct.

### Enter sends (#1510)

`handleKeyDown`: Cmd/Ctrl+Enter always sends ("from anywhere" per SPEC — even with the menu
open, deliberate). Plain Enter sends unless: `aria-expanded="true"` on the editor DOM (the
suggestion render sets/unsets this exactly when the menu is visible, including the mistyped-query
hidden state — verified in suggestion.ts `draw`/`onExit`), the caret's parent is a `codeBlock`,
Shift/Alt held, or `event.isComposing` (IME). Returning `false` defers to the suggestion
plugin's key handler, whose list picks on Enter. All four SPEC carve-outs implemented. One
sub-case: with an *empty-note* menu open (fresh `@` and no projects), Enter neither picks nor
sends (the list returns false for zero items) and falls through to a newline — consistent with
"Enter is left to an open suggestion menu", not a bug.

### Sizing, placeholder, a11y

Grow-to-cap via `viewportClassName` max-h on the ScrollArea viewport (compact: `max-h-32/min-h-8`;
full: `max-h-64/min-h-[2.75rem]`) — matches SPEC "rests short, grows, then scrolls; compact
starts one line". The visible placeholder span renders only `isEmpty` and is `pointer-events-none`;
`isEmpty` is kept true/false through every mutation path (onUpdate, load, clear). A11y: the
contenteditable gets `role=textbox`, `aria-multiline`, `aria-label="Prompt"`, and
`aria-placeholder` — but see bug 3: `editorProps.attributes` is captured once at editor creation,
while the visible span reads the live prop. `AgentComposer` passes a placeholder that *changes at
runtime* (live → resumable → not-continuable as the agent's state moves), so after a flip the
announced placeholder is stale and disagrees with the visible one — the SPEC's Accessibility
section makes the announced placeholder the primary one ("the visible placeholder text is
decoration on top of that").

### initialText seeding

Applied once when `editor` exists and `initialText` is truthy; `seeded` ref prevents re-apply.
The Composer sets `carriedDraft` in a mount effect (synchronously after first commit), so the
"late" arrival is one tick — no realistic window for a user to have typed. A subsequent
`initialText` change is ignored per SPEC ("never re-applied over what the user has since typed").
Correct.

## Functions (low-level)

### `insertToken(editor, range, spec)`

Deletes the trigger range, inserts token node + space, focuses. Runs as one chain (one undo
step). Correct.

### `applyTemplate(editor, text)`

`setContent(text)` (markdown-parsed, breaks preserved), `tokenizeEditorDoc` (chips for
macros/actions, skips inline code), focus end. Takes the live editor instance for the reason the
comment gives. Correct.

### `loadTemplateInto(ed, text)`

Captures `replaced` before replacing; manually reconciles the three derived states
(`isEmpty`, onChange markdown, mentions) that `setContent`'s non-emitting update skips. Loading a
preset over mention chips fires their removals here — SPEC explicitly requires that ("wiped out
by loading a preset"). Correct.

### `syncMentions(ed)`

See bugs 1 and 2 above. Also: text prefixes `#`/`@` fully partition the two kinds (file texts
always start `#`, project texts `@`), so the prefix dispatch is sound; duplicate chips of the
*same* target collapse in the Set, which is actually the right semantics (focus stays while at
least one chip remains, one removal when the last goes). Verdict: two bugs found.

### `useEditor` config

`immediatelyRender: false` (SSR-safe; the null-first-render is why refs and `initialText` exist).
StarterKit + Markdown(breaks:true — a preset's line-per-line block survives, per SPEC) + Token +
four triggers. `onUpdate` keeps `isEmpty`, markdown-out, and mentions in sync. Correct.

### Imperative handle (`clear`, `focus`, `loadTemplate`)

`clear` compensates for `clearContent`'s non-emitting update (empty flag, onChange(''), mention
sync — chip removals fire, so a cleared composer also un-focuses, consistent with #948).
`loadTemplate` returns false while the editor is null — the documented reason `initialText`
exists. Correct.

### `disabled` effect / seeding effect

`setEditable(!disabled)` post-mount and on change — correct. Seeding effect guarded by ref, does
not re-run once seeded. Correct.

## Bugs found

1. `L131-150` (`syncMentions`): chips restored by redo (or by undoing a preset load / a clear)
   reappear without their context focus — the sync only handles disappearances, and the picker
   callbacks do not run again. Scenario: `#`-mention a file (context gains it), Ctrl+Z, then
   Ctrl+Shift+Z → the chip is visible but the Context list no longer holds the path; the sent
   agent is not focused on what the prompt visibly claims. Contradicts SPEC "the prompt and the
   Context list can never disagree" (Mentioning is focusing). Severity: minor. Fix: in
   `syncMentions`, also diff `now` against the previous set and fire the add callbacks
   (`onMentionFile(text.slice(1))` / project-path lookup) for newly appeared chips; the pickers'
   direct calls then become redundant.
2. `L145` (`syncMentions` project lookup, with the insert at L280): a project chip stores only the
   display name (`@basename`), but basenames are not unique across registered projects
   (`ProjectSummary.name` is "the path's basename"). With two projects named `app`, mentioning
   the second and deleting its chip removes the *first* project's path from the context (or, with
   both mentioned, the Set collapses the two identical texts and deleting one removes nothing) —
   the real focus silently survives its chip. Contradicts the same SPEC invariant. Severity:
   minor. Fix: store the project path in the token attrs at insert time and key `syncMentions`
   on that attr instead of the label text.
3. `L306-312` (`editorProps.attributes`): `aria-placeholder` is set once from the mount-time
   `placeholder` prop and never updated, while the visible placeholder span tracks the live prop.
   AgentComposer swaps its placeholder at runtime (live → "Message the agent…", ended-resumable →
   "…continue it…", not-continuable → the can't-continue sentence), so a screen-reader user is
   announced the stale text — the SPEC's Accessibility section says the announced placeholder is
   the real one and the visible text mere decoration. Severity: minor. Fix: an effect that
   re-applies the attribute on change, e.g. `useEffect(() => { editor?.view.dom.setAttribute('aria-placeholder', placeholder) }, [editor, placeholder])`.
