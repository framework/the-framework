The shape shared by every background pass the daemon runs over the registered projects: no timer of its own, one turn per call from the daemon's single clock, and a stop that takes effect between projects.

Each turn walks the registered projects and does the pass's own work on one project at a time. Asking for a turn while one is already running joins the turn in flight rather than starting a second one or being dropped, so waiting for a turn always means a full pass finished. A stopped pass does nothing when asked for a turn, and stopping mid-pass takes effect before the next project rather than interrupting the current one. When the list of projects cannot be read, the turn walks nothing and the next turn tries again.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
