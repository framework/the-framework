What the launcher offers for one project, read once per project: its commands [1] and whether it has a start hook [2].

## Context

**Problem**: two surfaces need the same answer — the launcher's Start form, for its command buttons and its "no start hook" message, and the composer, for its `/` list and its Commands menu — and both must tell "not read yet" from "read, and the project has none", or the "no start hook" message would flash on every project while the read is in flight.

## Glossary

[1] command: one of the project's skills, read off the folders the coding agents read them from; typed as `/<name>`. Each says whether it was written to be run by a person, which is what makes it a launcher button.
[2] start hook: the one shell line under `start:` in the project's `.the-framework/hooks.yml`, which starts an agent and answers its id.

## Business logic

The read asks the daemon for the project's commands [1] and whether the project has a start hook [2]. Its answer is nothing until the daemon has answered, nothing when no project is open, and nothing for a project the daemon does not know. It is asked again when the project changes. A surface therefore says "this project has no start hook" only once it holds an answer that says so.
