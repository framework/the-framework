Tiny dependency-free Markdown renderer (#441) for surfaced PLAN/TODO docs and agent-pushed views: builds React nodes and never injects HTML, so agent-written content can't smuggle markup.

## TLDR

- Blocks: headings `#`–`######`, bullet + task lists (`- [ ]` renders a readonly checkbox), fenced code (also flushed when the doc ends mid-fence, via one shared `codeBlock`), GFM pipe tables (#869), paragraphs as fallthrough.
- Inline: `` `code` ``, `[text](url)`, `**bold**`, `*italic*`, bare-URL autolink — one left-to-right non-overlapping regex; backticked code wins, so a URL inside backticks stays literal.
- Links render only for `http(s)` targets (#948 — plans/summaries carry PR/issue URLs worth clicking); `javascript:` stays plain text.
- Consecutive `| … |` rows buffer into a table candidate; they become a real `<table>` only if row 2 is the GFM separator (`/^:?-{3,}:?$/` per cell), else they flush back as the paragraphs they would have been.
- Body rows key their cells off the header, so a short row leaves cells empty instead of collapsing the column; tables scroll in their own `overflow-x-auto` wrapper.
- `compact` drops everything a notch (text-xs body, smaller headings) so a reply reads at the surrounding event log's density.

## Decisions

- Hand-rolled instead of a markdown library: never-inject-HTML is the security property for agent-written content, and the supported subset is exactly what that content uses.

## Facts

- `\r\n` normalized to `\n` before line-splitting; `tableCells` drops the outer empty cells of `| a | b |`.
