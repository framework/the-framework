The greenfield build prompt: the opening prompt of a build agent whose workspace holds no app yet.

## Business logic

It frames a from-scratch, end-to-end build of the user's intent: the workspace may be empty, and if so the agent is to scaffold the whole project — package manifest with scripts, all config, every source file — install the dependencies, and make the app run, then summarize what it built in one short paragraph. The user's intent fills the first line; the stack is deliberately left to the agent.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
