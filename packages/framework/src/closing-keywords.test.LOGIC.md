What the tests cover:

- **A real sentence keeps its words** - a plan's closing sentence ("…then comment on and close #1164") comes out reading the same, with only "the ticket" inserted before the reference, so a reviewer sees prose rather than an escape.
- **Every keyword form** - all nine keywords GitHub accepts — "close", "closes", "closed", "fix", "fixes", "fixed", "resolve", "resolves", "resolved" — are defused in lower case and in upper case alike.
- **The colon form** - a keyword joined to the reference by a colon (`Fixes: #1164`, `CLOSES: #10`, `resolves:#7`) closes just as well and is defused too, with the colon and its spacing kept exactly as written.
- **The cross-repository form** - a reference naming another repository (`owner/repo#7`) closes an issue there and is defused as well.
- **The reference stays live** - no backticks are added around the reference and it survives as a plain reference, so it stays clickable and merging still cross-references it onto the issue's own timeline.
- **What is not a command** - an issue reference with no keyword in front of it is left alone; a word that merely ends in a keyword ("enclose #42") is not a keyword; a phrase already inside backticks is a code sample and is left alone.
- **Defusing twice is defusing once** - running the rewrite on text it already produced changes nothing further (`fixes #9 and closes #10` settles at `fixes the ticket #9 and closes the ticket #10`).
