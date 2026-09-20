Tests of the widget calls (`widgets.ts`), against a throwaway registry and throwaway projects on disk.

Covered:
- The widgets are every registered project's, one entry per package, served from the first project that has it and listing every project that has it; a package with no `./dashboard` export is not a widget.
- A widget's command runs in its project and answers its JSON; a package that is no widget, a widget of another project and an unknown project are refused with their reasons.
- A widget's command may write what the framework reads through a provider: after the queue package's `add` runs through the call, the framework's next read of that project's queue runs the provider again and shows the new entry, instead of the copy read a moment before.
