Renders one widget's [1] page in the dashboard's main pane.

## Glossary

[1] widget: a browser module one of a project's packages brings to the dashboard, named by the package's `exports["./dashboard"]`; it adds pages to the dashboard and reads its data through its own package's command.

## Business logic

The page component is given the registered projects that have its package (by id and name, in the registry's order, leaving out any the dashboard does not currently list) and the URL segments after its own. Around it, the view provides what `useWidgetHost()` reads: the widget's package, so the page's commands run in that package only, and the shell's services (`lib/host-services.ts`): opening an agent or a page, starting or configuring a run, a project's runs. A page that throws while rendering shows "The `<label>` page failed: `<reason>`" in its place, and the rest of the dashboard keeps working; moving to another widget page starts it fresh.
