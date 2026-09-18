The `maintainability` command skill: a skill file the coding agent's harness expands from `/maintainability`, the prompt of the agent a person starts for refactoring a part of the code to make it as maintainable as possible, published as a pull request a person reviews. Marked so that only a person or a runner invokes it; the agent never chooses it by itself.

## Context

**User story**: a person types `/maintainability` and, after it, the part of the project to work on. The agent finds the part's maintainability red flags, fixes them on its branch, and opens a pull request listing each red flag and its fix; a person reviews it and merges it.

**Business logic story**: the skill names no skill and no command, and assumes no capability. The agent composes the capability skills tracked in the project on its own; what this file carries is the rules of the job, which an agent nobody answers cannot infer from the skills alone.

## Business logic — TL;DR

- **Nobody answers** - the agent never asks and decides by itself.
- **The part** - what follows the slash command, a folder, a file or a feature in words; the whole project when nothing follows it.
- **Red flags** - the agent looks for maintainability red flags in the part and fixes them.
- **Publishing** - each change committed on the agent's branch, the branch pushed and its pull request opened; the merge is left to a person. The pull request's body lists each red flag found and how it was fixed.
- **Nothing found** - it says so and stops, publishing nothing.
