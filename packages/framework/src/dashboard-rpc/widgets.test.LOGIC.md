Tests of the widget calls (`widgets.ts`), against a throwaway registry and two throwaway projects on disk.

Covered:
- The widgets are every registered project's, one entry per package, served from the first project that has it and listing every project that has it; a package with no `./dashboard` export is not a widget.
- A widget's command runs in its project and answers its JSON; a package that is no widget, a widget of another project and an unknown project are refused with their reasons.
