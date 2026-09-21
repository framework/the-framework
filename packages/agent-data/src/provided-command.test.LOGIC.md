What the tests cover, against real files: a throwaway project whose `package.json` lists dependencies, each installed under `node_modules` with its own `package.json` and a small command.

- **One provider** - the one package declaring a kind provides it, with its command's absolute path; a declaration naming a command the package lacks is skipped; a kind nobody declares is nothing and no problem; a project with no `package.json` is nothing.
- **Two providers** - with no line in the project's `package.json` nothing provides, never the first in dependency order, and the problem names both packages and the line to write; the line naming one makes that one the provider; a line naming a package that does not provide the kind is a problem naming the providers, also when there is only one.
- **Running a command** - a command runs with Node in the project root and answers its JSON; a failing command answers its last standard-error line; a command printing text is "printed no JSON".
