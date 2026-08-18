Covers the wait applied when a Resume races a just-finished agent's exit: a free slot returns at once, a leg still calling itself running is a real collision and is not waited on, a finished leg is waited out within a bounded grace period, and an in-flight or failed retirement never breaks the continuation awaiting it. A leg that cannot be read at all is a fourth answer, not a live one: it is asked again until it commits, so a meta caught mid-rewrite never costs the continuation its wait, while a leg that goes on to report itself running still reaches the guard without sitting out the grace.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
