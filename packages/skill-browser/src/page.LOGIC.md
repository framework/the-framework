What the agent [1] does to the page, each a few DevTools requests: reading the page as text with its elements numbered, opening an address, clicking, typing, pressing a key, taking a screenshot and running a script. Every action waits for the page to settle, and a refusal is a sentence the agent reads.

## Context

**Problem**: the agent cannot see the page; it needs the page as text, and a way to point at one element of it that still means the same element on its next command.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] element number: the number `[n]` a read gives each visible link, button or field, written onto the element itself in the page (`data-browser-ref`), so `click n` and `type n` find the very element the last read listed.

## Business logic — TL;DR

- **Reading the page** - `Title:`, `URL:`, the page's text (cut at 10,000 characters, saying how many more there were), then up to 300 visible elements of the page's own document (nothing inside an iframe or a shadow root), each numbered [2] with its kind, its label and what it holds, and a last line counting the elements left out.
- **Waiting for the page to settle** - 250 ms for a navigation to begin, then until the document says it has loaded (up to 10 seconds), then 200 ms more; a slow page is read as it stands.
- **Opening an address** - `http` or `https` as given, an address with no scheme gets `http://` (`localhost:3000` included), any other scheme is refused; an address Chrome cannot open is refused with Chrome's reason.
- **Clicking** - a real mouse click at the middle of the numbered element, scrolled into view first; a number the page no longer has is refused.
- **Typing** - on a select, picks the option whose text or value is the text; on a date, time, datetime-local, month or week field, sets the value as a picker would, refusing a value the field rejects with an example of the right shape; on a text field, text area or editable element, focuses it, selects what it holds and types the text over it; any other element (a button, a checkbox, …) is refused with "click it instead".
- **Pressing a key** - one of nine keys, as a key press the page sees; any other key is refused with the list.
- **A screenshot and a script** - the visible part of the page as a PNG; a script's return value as indented JSON, `undefined` when it returns nothing, a value JSON cannot hold (`Infinity`, `NaN`, `-0`, a BigInt) as DevTools spells it, and a script that throws is refused with its error.

## Business logic

### Reading the page

#### Context

See `## Context`.

#### Business logic

A read first removes every element number [2] the previous read wrote, then walks the page's links with an address, buttons, inputs other than hidden ones, text areas, selects, `summary` elements, elements with the role button, link, checkbox, tab or menu item, and editable elements, in document order. It reads the page's own document only: neither the text nor the elements inside an iframe or a shadow root are read, so they carry no number. An element counts only when it is shown: it has a size, and it is neither `visibility: hidden` nor `display: none`. The first 300 shown elements are numbered from 1. Each is listed as `[n] <kind> "<label>"<more>`:

- The kind is the element's role when it has one, else `link` for a link, `input` for a text input, `input[<type>]` for any other input, and otherwise the tag name (`button`, `select`, …).
- The label is the first of: its accessible label, the text of its first form label, its own text (not for inputs, text areas and selects), its placeholder, title, alt text, or name; whitespace collapsed, cut to 80 characters.
- More is ` -> <href>` for a link, ` (checked)` or ` (not checked)` for a checkbox or radio button, ` value="<value>"` for any other input, text area or select, and ` (disabled)` added for a disabled element.

The read prints `Title: <title>`, `URL: <address>`, a blank line, the page's visible text with runs of three or more line breaks collapsed to two, or "(no text on the page)", a blank line, and then "Elements (the number is what click and type take):" followed by the list, or "Elements: none". When more than 300 shown elements were found, the list ends with "… <n> more elements not listed: find them with eval"; those carry no number. Text beyond 10,000 characters is cut and followed by "… (<n> more characters not shown)".

### Waiting for the page to settle

#### Context

**Problem**: a click may start a navigation or a script-drawn update; reading at once would print the page before it changed.

#### Business logic

After every action the page is given 250 ms for a navigation to begin; then the document's ready state is asked every 100 ms until it is `complete` (a question that fails, as it does mid-navigation, counts as still loading), for at most 10 seconds; then 200 ms more for a script-rendered page to draw. Running out of time is not a failure: the page is read as it stands.

### Opening an address

#### Context

**User story**: the agent types `localhost:3000/a` as it would in a browser's address bar.

#### Business logic

An address starting with `http://` or `https://`, in any case, is opened as given. An address that starts with another scheme (`file:`, `javascript:`, …) is refused: "only http and https addresses open: <address>"; a host followed by a colon and a port, such as `localhost:3000`, is not a scheme. Any other address gets `http://` in front. When Chrome reports that the address did not open, the refusal is "<address> did not open: <Chrome's reason>"; otherwise the page is left to settle.

### Clicking

#### Context

See `## Context`.

#### Business logic

The numbered element is scrolled to the middle of the view, and the mouse is moved to its middle, pressed and released there with the left button, so the page sees what a person's click makes; then the page settles. A number no element carries is refused: "no element [<n>] on the page: read it again, the numbers change when the page does".

### Typing

#### Context

**User story**: the agent fills a form field, or picks "Blue" in a colour select, with the same command.

#### Business logic

The numbered element is scrolled into view (a missing number is refused as for a click). On a select, the first option whose trimmed text or whose value equals the text is chosen and the page is told the select changed, as a person's choice would; with no such option the refusal is "no option "<text>"; the options are <each option's text>". A date, time, datetime-local, month or week input takes no typed characters: its value is set to the text directly and the page is told the field changed, as a person's picker would; when the field does not keep the value, it is refused: ""<text>" is not a <type> value; give it as <example>", the examples being `2024-01-31`, `13:45`, `2024-01-31T13:45`, `2024-01` and `2024-W05`. Any other element that takes no text is refused: "element [<n>] takes no text: click it instead"; the elements that take text are text areas, editable elements, and inputs of every type but checkbox, radio, button, submit, reset, image, file, range and color. Such an element is focused and what it holds is selected (a field's content, or an editable element's children), and the text is typed in its place; one that does not take the focus is refused: "element [<n>] does not take the focus". The page then settles.

### Pressing a key

#### Context

See `## Context`.

#### Business logic

The keys are Enter, Tab, Escape, Backspace, Space, ArrowUp, ArrowDown, ArrowLeft and ArrowRight; each is sent as the key going down then up, Enter and Space also typing their character, so a form submits on Enter. Any other key is refused: "unknown key <key>; the keys are <the list>". The page then settles.

### A screenshot and a script

#### Context

See `## Context`.

#### Business logic

A screenshot is the visible part of the page as PNG bytes. A script runs in the page as in a browser's console, so `await` works at its top level (the page's own reads and actions run without this), and a promise it returns is awaited; its value comes back as JSON indented by two spaces, or "undefined" when it returns nothing, a page element coming back as `{}`; a value JSON cannot hold (`Infinity`, `NaN`, `-0`, a BigInt) comes back as DevTools spells it, such as `Infinity` or `12n`. A script that throws is refused with the error's description, or "the script threw".
