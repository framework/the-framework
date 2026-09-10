Answers "is an agent [1] working for me right now?", across every registered project [2], re-asked every 5 seconds. The answer is true as soon as any project has a running agent, and it is what turns the browser tab's icon into its working state (the icons are in `favicon.ts`).

Deliberately cross-project: the question the tab icon answers is whether the product is working for the user at all, not whether the project that happens to be selected is busy. An agent left going in another project still means work is under way.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] project: a repository the user registered in the dashboard, identified by an id derived from its path.
