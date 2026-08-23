What the tests cover for a project's committed `the-framework.yml`.

**What it reads.** The two mode switches — `vanilla` and `transparent` — individually and together, and the `handoff` rung naming any of `local`, `push`, `pr` or `merge`. An empty document, or one holding only comments, carries no settings. Reading the file from a project directory yields exactly what it named, and a directory with no such file yields no settings at all.

**What it refuses.** A document that is not a map of settings. A mode switch whose value is not a true/false value. A `handoff` naming a rung that does not exist, or spelled as a true/false value — refused by name, so a typo is a startup error rather than an agent that quietly publishes nothing.

**Only the current spellings.** Every retired key — the three publish booleans the handoff rung replaced, the inverted spelling of `vanilla`, and the abandoned preset/event keys — is simply an unknown key now, and unknown keys are ignored. There is no migration path; the file is rewritten by hand.

**Failure is a warning.** A malformed file is reported as an ignored file, naming it, and the project is treated as having configured nothing — never a failed agent.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
