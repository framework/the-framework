Wires a trigger character to a floating suggestion menu in the composer [1]'s prompt editor: typing the character opens a menu at the caret listing what the trigger offers for the text typed after it, key presses steer and pick from the menu, and a pick hands the chosen item back to the trigger to insert in place of the typed text. Each of the editor's triggers (`/`, `<`, `@` and `#`, defined in `PromptEditor.tsx`) is one instance of this mechanism with its own menu, so two triggers never interfere with each other.

## Context

**User story**: the user types `/` in the composer [1] and a menu of presets and actions appears under the caret; they keep typing to narrow it, move through it with the arrow keys and pick an entry; the menu vanishes when they type a space or move the caret away. Typing `@` or `#` in the same way offers projects and files. A stray `<` or `@` in ordinary prose must not trap the user in a menu.

## Glossary

[1] composer: the prompt editor, also used for live chat.

## Business logic — TL;DR

- **When a trigger is open** - the trigger character counts only at the start of a line, right after a space or right after a chip; the query is what follows it up to the caret and ends at the first space; the trigger closes when the caret leaves that text, when text is selected, or when an item is picked.
- **The query is matched ignoring letter case** - what the user typed after the trigger character is lower-cased before the trigger's own item source filters on it.
- **The menu floats at the caret** - it opens just below the caret, flips above it when the caret is near the bottom of the window, and follows the caret through scrolling and window resizing.
- **An empty source shows a note, a mistyped query hides the menu** - a fresh trigger over an empty source shows the trigger's note, while a query that matches nothing hides the menu but keeps the trigger armed, so the menu is back the moment a later key matches.
- **Keys reach the menu while a trigger is open** - key presses go to the menu list first, which steers and picks as described in `SuggestionList.tsx`; Escape is passed through untouched.
- **A pick replaces the trigger text** - the picked item and the span from the trigger character to the caret go to the trigger's own insertion, which replaces that span.
- **The open menu is announced** - while the menu is visible the editor reads as an expanded combobox pointing at the highlighted entry, and the same signal is what makes Enter pick from the menu instead of sending the prompt.

## Business logic

### When a trigger is open

#### Context

See `## Context`.

#### Business logic

A trigger character opens its menu only where it starts a word: at the start of a line, right after a space, or right after a chip. In the middle of a word (`foo@bar`) it is ordinary text. The query is the text from the trigger character to the caret; it cannot contain a space or a second trigger character, so typing a space ends the trigger. The trigger also closes when the caret moves outside the trigger text, when the user selects text, when the editor is not editable, and after an item is picked. Every trigger is keyed on its own, so the `/`, `<`, `@` and `#` menus never open together or share state.

### The query is matched ignoring letter case

#### Context

**User story**: the user types `/Sec` or `/sec` and gets the same "Security audit" preset offered.

#### Business logic

The query is lower-cased before it reaches the trigger's item source; which items match a query is the trigger's own rule, defined per trigger in `PromptEditor.tsx`.

### The menu floats at the caret

#### Context

**Problem**: the editor scrolls inside its own box and the page scrolls around it; a menu pinned where it first opened would drift away from the text it belongs to.

#### Business logic

The menu is drawn over the page, left-aligned with the caret and just below it. When the caret is near the bottom of the window, the menu opens above the caret instead, so it stays fully visible. It is repositioned on every scroll of any container, including the editor's own, and on every window resize, so it tracks the caret while the trigger is open.

### An empty source shows a note, a mistyped query hides the menu

#### Context

**Problem**: with nothing registered yet, a trigger that showed nothing at all would look broken; and a `<` or `@` typed in prose, followed by text that matches nothing, would trap the user in a menu if the menu insisted on staying open.

#### Business logic

On a fresh trigger, with nothing typed after the character, an empty item source shows the trigger's note in place of a list (for example "No projects to reference yet." for `@`); a trigger without a note shows nothing. Once a query is typed, a query that matches nothing hides the menu entirely, but the trigger stays armed: if a later key makes the query match again, the menu reappears with the matches. Whenever the menu is hidden, no entry is highlighted.

### Keys reach the menu while a trigger is open

#### Context

See `## Context`.

#### Business logic

While a trigger is open, every key press is offered to the menu list before the editor sees it; the list decides which keys it consumes (arrows, Enter and Tab, per `SuggestionList.tsx`) and the rest reach the editor as normal typing. Escape is the one key never offered to the list: it passes through to the editor and the page, and does not close the trigger by itself.

### A pick replaces the trigger text

#### Context

See `## Context`.

#### Business logic

When an entry is picked, the trigger's own insertion receives the picked item together with the span from the trigger character to the caret; the insertion deletes that span and puts its result there (a chip, a loaded preset, or an opened panel, per trigger). Because the trigger text is gone, the trigger closes.

### The open menu is announced

#### Context

**Problem**: a screen reader user gets an unlabeled editable region unless the editor says a menu is open and which entry is highlighted; and the editor's Enter key, which sends the prompt, must know when Enter means "pick this entry" instead.

#### Business logic

While the menu is visible, the editor is marked as expanded and names the highlighted entry as its active descendant; the marks follow the highlight as it moves and are cleared when the menu hides or the trigger closes. The expanded mark reflects what the user actually sees, not whether a trigger is armed: a hidden menu after a mistyped query reads as closed. The editor's Enter-to-send rule in `PromptEditor.tsx` reads this mark, so Enter picks from a visible menu and sends the prompt otherwise.
