What the tests cover, for the bar at the top of the project home [1]:

- **The menu alone** - the bar's whole text is the "⋮" menu: no project name, no branch, no "clean", no "dirty". The menu is given the project and no agent [2]. The bar asks the daemon nothing: any read fails the test.
- **Laid out as an agent's top bar** - the row has no border, has the row styling of the action bar at the top of an agent's page, and holds a spacer then the menu, the menu last. The test DOM has no layout, so this is checked on the elements' styling.

## Glossary

[1] project home: a project's own page with the launcher (the Start form) and its composer (the prompt editor, also used to say something to an agent).
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
