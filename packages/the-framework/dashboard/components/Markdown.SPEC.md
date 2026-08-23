Renders the markdown the dashboard displays — the plan and TODO documents it surfaces, and the notes and summaries agents write — as formatted text rather than raw characters. Agent-written content is never treated as markup, so nothing an agent writes can smuggle live HTML into the dashboard.

## Business logic — TL;DR

- **Only what agent-written documents actually use** - headings, bullet lists, task lists with their checked state, fenced and inline code, bold and italic, links, and pipe tables. Anything else is shown as an ordinary paragraph rather than dropped or shown as syntax.
- **Links are clickable but only ever to the web** - both `[text](url)` links and bare URLs become links, and only `http` and `https` targets do; every other target stays plain text, so no link can be made to run something. Links open in a new tab.
- **Malformed input still reads** - rows of pipes that are not a real table are shown as the paragraphs they were; a code fence the document never closes still renders as a code block up to the end.
- **Code is literal** - inline code wins over every other inline mark, so a URL or an asterisk inside backticks stays exactly as written.
- **Compact mode** - the same content can be rendered a notch smaller so a reply reads at the density of the surrounding event log instead of as a full document.

## Business logic

### Agent-written content can never become markup

#### User story

An agent writes a plan, a summary, or a chat reply, and the user reads it in the dashboard. The user must be able to trust that reading it is safe, no matter what the agent (or anything the agent quoted from a repository or a web page) put in the text.

#### Business logic

Formatted output is constructed as text and known formatting elements only; the document's characters are never interpreted as HTML. Links are the one element that points outward, and they are created only for `http` and `https` addresses — a link written to any other kind of target is left as the plain text it was.

### What formatting is understood

#### User story

Agents write plans, comparisons, and checklists, and the user should read them as documents, not as markdown source.

#### Business logic

Headings at all six levels render as bold lines, sized by level. Bullet lines become a bulleted list; a bullet written as a task (`- [ ]` / `- [x]`) instead becomes a checklist item showing whether it is done — displayed only, not something the user can tick. Fenced blocks become scrollable code blocks. Within a line, backticked code, bold, italic, `[text](url)` links, and bare URLs are formatted, left to right and without overlapping.

A run of pipe rows becomes a table only when the second row is the header separator that marks it as one; otherwise the rows are shown as ordinary paragraphs, because they were prose that happened to contain pipes. A table's rows are padded to the header's column count, so a short row does not shift the columns.

#### Rationale

Tables were added because an agent comparing options or listing files reaches for one, and until then they rendered as raw pipes. Links were added because plans and summaries carry pull request and issue addresses that the reader wants to click.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
