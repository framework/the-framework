Tests of the module calls (`modules.ts`), against a throwaway registry and throwaway projects on disk.

Covered:
- The modules are every registered project's, one entry per package, served from the first project that has it and listing every project that has it, the built-in modules (Files, the logs package's) first and every project's; a package with no `./dashboard` export is not a module.
- A module's command runs in its project and answers its JSON; a package that is no module, a module of another project and an unknown project are refused with their reasons.
- A module's command may write what OpenAgent reads through a provider: after the queue package's `add` runs through the call, OpenAgent's next read of that project's queue runs the provider again and shows the new entry, instead of the copy read a moment before.
- A module's read is called in its project with the project's folder and the input, and answers its JSON; a module with no server part, a package that is no module and an unknown project are refused with their reasons; the built-in Files module reads the project's own files.
