Tests of a project's widgets (`project-widgets.ts`), against throwaway project directories on disk with real packages and real Node scripts as commands.

Covered:
- A project's widgets are the dependencies and dev dependencies whose package exports `./dashboard` to a file inside it, in name order, with their version, module directory, module file and commands; a package without the export, an uninstalled one, one whose export points outside it and one whose export names a missing file bring none; a linked package is followed to where it lives; a conditional export is read through its `import` target; a project without `package.json` has none.
- A widget serves its module's sibling files and files in subdirectories, and nothing climbing out, nothing reached through a symlink pointing out, no directory, no empty path and no missing file.
- A widget's command runs in the project root with the given arguments and answers its JSON; a non-zero exit answers the command's last standard-error line; output that is not JSON, an unknown command name and too many arguments are refused with their reasons; a package with several commands must name one and then runs that one.
