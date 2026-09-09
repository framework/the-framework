---
name: logic-driven-development
description: "Before modifying/creating LOGIC.md files, you must always read this skill."
user-invocable: false
---

# Logic-Driven Development

For each file and directory containing software source code, a `LOGIC.md` file describes what the code does.
- `some-file.ext` => `some-file.LOGIC.md`
- `some-dir/` => `some-dir/LOGIC.md`


## Goal

AI writes the code; the engineer stays in control of the business logic. `LOGIC.md` files are where that control happens: reviewing a change means reading `LOGIC.md` diff, and understanding any part of the system means reading `LOGIC.md` — never the code.

A `LOGIC.md` is the answer to "how does this work?" — the business logic, nothing else.

Write for exactly one reader: the technical product manager — knows the project and its user stories, proficient in programming and software engineering, never reads the code.
- Assume zero knowledge about the code. Technical writing is fine; presupposing what the code looks is not.

Content:
- 100% coverage of high-level business logic from a bird's view
- Only explains what the code does — the only additional context is in the `Context` sections
- Skip source code that don't represent business logic, e.g. `examples/`
  - Except tests: create a `LOGIC.md` only describing what the tests cover (don't explain how the test file work)

Clear writing:
- Zero ambiguity: the reader must never second-guess what a sentence means
- Minimal prior reading: each sentence understandable on its own
- Established concepts => use their established name, whatever the domain
- No new jargon. Coin a term only when the concept has no established name, and explain every coinage in `## Glossary`.
- One concept => one name, used verbatim across all `LOGIC.md` files. Never rotate synonyms: the reader assumes different words mean different things.


## File content

```md
Short description of the business logic this file/directory implements.

## Context [optional]

Context that two or more business logic below relate to.

## Glossary [optional]

[1] some jargon: explanation
[2] some other jargon: explanation

## Business logic — TL;DR [required if `## Business logic` exists]

- **Some business logic** - short description
- **Some other business logic** - short description

## Business logic [optional]

### Some business logic

#### Context [required]

Context the business logic relates to (can be a reference to `## Context`)

#### Business logic [required]

The business logic that the code implements.

### Some other business logic

...
```

Note:
- The `[required]`/`[optional]` are labels to denote whether you can omit a section
  - For example, for a small file, a short description can be enough
- Every time you use jargon, refer to `## Glossary`: `some jargon [x]`
- The `Context` sections:
  - Two goals — make it clear to the technical product manager:
    1. How the business logic fits into the global context
    2. Why the business logic exists
  - Consider using these subsections:
    - `User story`
       - List of user stories the business logic relates to
       - The "user" refers to the end user — connect the business logic to what happens from the end user's perspective, which is the perspective the technical product manager is most familiar with
       - Since the reader is familiar with user stories, this is a great opportunity to bring the reader into the context
    - `Business logic story`
       - List of business logic stories the business logic relates to
    - `Problem`
       - List of problems the business logic relates to


## Hierarchy

The file structure often represents levels of abstraction => mirror it:
- Root `LOGIC.md`:
  - The highest-level answer to "what does this software do?" — the high-level product's story
  - How the top-level subsystems relate (instead of a low-level repository overview)
- Deeper `LOGIC.md` files => each subsystem's story


## Install

When the user asks to install or set up LDD: generate a `LOGIC.md` for each file and directory containing software source code — the entire code base, in one go.
