What the tests cover: everything the daemon decides about an agent survives the handoff to the spawned agent unchanged, and an option deliberately left unsaid arrives unsaid — so the repo's committed `the-framework.yml` still gets to decide it — while an explicitly chosen value arrives as chosen. Reading a spec consumes it: the file and the whole directory the framework made for it are gone once read, so a device token never outlives the agent that used it.

Cleanup is covered for what the framework does not own: a hand-written spec loses only the named file and keeps the user's directory and its other contents, even when that directory happens to share the framework's own naming, as long as it is not in the framework's spec home. A spec whose agent never started is cleaned up by the daemon, directory and all.

Refusal and defaults are covered too: unreadable content, a spec missing its kind and checkout, and a path that does not exist are all refused rather than half-run; a spec that states no options reads as one with no options rather than nothing at all. Finally, each start writes its own private spec file, so two agents starting at once never share one, and the file is written as readable text, so an agent that dies on startup can be diagnosed from it.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
