The `readability` command skill: a skill file the coding agent's harness expands from `/readability`, the prompt of the agent a person starts for refactoring a part of the code to make it as easy as possible for humans to read, every file and function rated before and after, published as a pull request a person reviews. Marked so that only a person or a runner invokes it; the agent never chooses it by itself.

## Context

**User story**: a person types `/readability` and, after it, the part of the project to work on. The agent rates every file and every function of the part for its abstraction, its place and how linearly it reads, refactors, one commit per refactor, and opens a pull request whose body is the list again with each old and new rating and the commit that changed it.

**Business logic story**: the skill names no skill and no command, and assumes no capability. The agent composes the capability skills tracked in the project on its own; what this file carries is the rules of the job, which an agent nobody answers cannot infer from the skills alone.

## Business logic — TL;DR

- **Nobody answers** - the agent never asks and decides by itself.
- **The part** - what follows the slash command, a folder, a file or a feature in words; the whole project when nothing follows it.
- **The architectural split** - each file and each function judged as an abstraction and by its place: whether a responsibility sits on the right side of each call's boundary, since well-factored is not well-located.
- **Linearity** - callers above callees; each entry point read top to bottom as prose, every line that drops into lower-level mechanism flagged and, where it can, moved down into the callee.
- **Rate everything first** - before any change, every file and every function rated from 0 to 10 with a reason, and a second list ticking each one to prove none was skipped; mostly 10s is called lazy.
- **One commit per refactor** - each refactor is its own commit.
- **Publishing** - each change committed on the agent's branch, the branch pushed and its pull request opened; the merge is left to a person. The pull request's body and the last message are the list again, old rating, new rating, and the commit of each change.
- **Nothing to change** - it says so with the ratings and stops, publishing nothing.
