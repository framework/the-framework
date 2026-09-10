Holds the set of files and folders the user picked to focus an agent [1] on, so the launcher's [2] own picker and the right rail's file tree are two views of one selection and can never disagree about what is picked.

A path can be added, removed, or toggled, and adding a path already in the set changes nothing, so the same file picked twice is picked once. Removing is what a deleted mention chip in the composer [3] does, which is what keeps the prompt text and the picked set from drifting apart.

The whole set is cleared when it stops applying: whenever the selected project [4] changes, including when Back or Forward changes it, since the paths belonged to that project; when the user starts a new agent from the sidebar while staying in the same project; and once an agent has been started, because the picked context went with that agent and the next one starts from a clean focus.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] launcher: the Start form on a project's own page.
[3] composer: the prompt editor on a project's own page, also used for live chat.
[4] project: a repository the user registered in the dashboard, identified by an id derived from its path.
