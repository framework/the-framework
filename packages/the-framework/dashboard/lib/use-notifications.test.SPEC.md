What the tests cover: the dashboard stays quiet about what was already waiting when the page was opened, and speaks up about what happens afterwards.

- **Interventions** - pull requests already open at load are absorbed as backlog while a later one produces a notification titled with the Human Queue; an agent that parks at a gate afterwards produces a notification carrying its question.
- **Backlog recognition** - a reading that reached no project at all is not treated as backlog, so a dashboard opened while GitHub is unreachable does not announce every already-open pull request the moment GitHub answers; and a project that cannot be read never holds back notifications for a project that can, while that unreadable project's own backlog is still absorbed silently the first time it does answer.
- **The toggle** - with the category switched off nothing is ever shown, and switching it back on does not replay what arrived while it was off.
- **Activity** - agents already present at load are absorbed as backlog; an agent starting afterwards produces a notification naming it; and the same agent finishing produces a second, separate notification.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
