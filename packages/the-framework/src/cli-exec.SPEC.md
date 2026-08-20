One shared way to run a command-line tool such as git or gh: hand back its output, and kill it if it outruns its time budget so a hung tool can never hang the framework.

## Flows

- The budget can depend on the operation — pushing to a remote deserves more time than reading a value.
- A kill is reported as a timeout, distinct from the tool refusing.
- A tool that explains itself on its error output (gh does) can have that shown instead of a generic failure.

## Rationales

- Budgets attach to operations rather than to the binary because one binary is not one operation.
- A timeout is its own outcome because a killed push says nothing on its own and would otherwise read as a rejected one.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
