Takes the issue-closing authority out of a pull request's prose without changing what the prose says: `close #42` becomes `close the ticket #42`. GitHub closes an issue on merge only when a closing keyword sits directly in front of the reference, so slipping two words in between ends the command while the sentence still reads as the agent [1] wrote it and the issue reference stays live.

## Context

**User story**: a plan agent [2] is started for a ticket. Its plan says "…then close #42", which is a true description of what implementing the ticket will do. Its pull request lands the plan, not the implementation, and the user expects the ticket to still be open — with its fresh plan — after that pull request merges.

**Problem**: a closing phrase anywhere in a merged pull request's title or body closes the issue it names. On a pull request that delivers the work, that is exactly right, and the handoff [3] puts "(fix #N)" on such a title on purpose. On a pull request that delivers something short of the work, it silently closes a ticket whose work has not started, and the next tickets sync then removes the closed ticket and the plan just written for it. Forbidding the phrase is the wrong cure: the agent is describing its plan and the sentence is true.

**Business logic story**: which text is defused is decided where an agent [1]'s pull request is prepared (`cli.ts`): both the title and the body of a plan agent [2], and nothing else.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] plan agent: an agent started to write a ticket's plan rather than to implement the ticket; its pull request lands the plan, not the work.
[3] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).

## Business logic — TL;DR

- **What counts as a closing phrase** - one of GitHub's nine closing keywords, in any letter case, directly in front of an issue reference in either its plain or its cross-repository form.
- **Defusing it** - the words "the ticket" are inserted between the keyword and the reference, keeping the sentence's own punctuation, so GitHub no longer reads a command and the reference still points at the issue.
- **What is left alone** - a reference inside backticks, which GitHub never acts on and which rewriting would corrupt; and text already defused, which a second pass leaves unchanged.

## Business logic

### What counts as a closing phrase

#### Context

See `## Context`.

#### Business logic

The keywords are the nine GitHub accepts: "close", "closes", "closed", "fix", "fixes", "fixed", "resolve", "resolves" and "resolved", matched whatever their letter case. The keyword must be a word of its own, not the tail of a longer word. The reference that follows is either the plain `#123` form or the cross-repository `owner/repo#123` form, which closes an issue in another repository just as well. Between the two, GitHub allows only whitespace or a colon (`Closes: #10`), and so does this rule; anything else already breaks the adjacency and is not a closing phrase.

### Defusing it

#### Context

**Problem**: the fix must not make the text read as machine-mangled. A reviewer reads this prose, and an escape sequence in the middle of a sentence is worse than the sentence.

#### Business logic

Every closing phrase is rewritten with the words "the ticket" between the keyword and the reference, chosen so the result reads as the sentence's own words. Whatever separated the keyword from the reference — the spaces, or the colon and its spacing — is kept exactly as written, so the sentence keeps its punctuation. The issue reference itself is never touched: it stays clickable, and merging the pull request still cross-references it onto the issue's timeline, so the ticket is still told that a pull request mentioned it. Only the authority to close is removed.

### What is left alone

#### Context

**Problem**: an agent's prose often quotes code and command lines. A rewrite inside a code sample would corrupt the sample, and GitHub does not act on a reference inside backticks in the first place.

#### Business logic

A closing phrase whose reference sits inside backticks is left exactly as written. Text that has already been defused is unchanged by a further pass, because the keyword is then followed by the inserted words rather than by a reference, so defusing the same text twice is the same as defusing it once.
