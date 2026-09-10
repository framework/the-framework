Renders the floating menu a trigger opens in the composer [1]'s prompt editor: a list of entries, each with a label and a hint, grouped under headers ("Presets", "Actions", "Tags", "Projects", "Files"), with one entry highlighted; the arrow keys move the highlight, Enter or Tab picks it, and the mouse hovers and clicks the same way. The list is steered from the editor, where the keyboard focus stays, so it reads to assistive technology as a list box whose highlighted entry the editor points at.

## Glossary

[1] composer: the prompt editor, also used for live chat.

## Business logic — TL;DR

- **The first entry is highlighted** - whenever the list changes, which is on every keystroke of the query, the highlight returns to the first entry, so it never points past the end of a list that shrank.
- **Arrow keys move, Enter and Tab pick** - the down and up arrows move the highlight and wrap around at both ends; Enter or Tab picks the highlighted entry; with an empty list no key is consumed, so it reaches the editor as ordinary typing.
- **The mouse steers the same highlight** - hovering an entry highlights it and pressing it picks it, without moving the keyboard focus out of the editor.
- **Entries are grouped and described** - consecutive entries of the same group share one header above them; each entry shows its label with its hint at the right, and an entry may carry a longer hover text where its label and hint do not say where its output lands.
- **The empty state is a note** - with no entries, the list shows the trigger's note, or "No matches" when the trigger has none; it is only ever shown on a fresh trigger that has a note, since a mistyped query hides the whole menu (`suggestion.ts`).
- **The highlighted entry is announced** - the list is a list box labeled "Suggestions", and the highlighted entry's identity is reported outward so the editor can name it as its active descendant; with no entries, nothing is reported.
