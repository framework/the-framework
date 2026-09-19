Serves a widget's [1] files to the browser: its module, its stylesheet, any file beside them, under `/_widgets/<project id>/<package>/<file>`.

## Context

**User story**: the dashboard learns that a registered project has the `logs` widget and imports its module from `/_widgets/<project id>/%40gemstack%2Fskill-logs/dashboard.js`; the module's stylesheet comes from the same place.

## Glossary

[1] widget: a browser module one of a project's packages brings to the dashboard, named by the package's `exports["./dashboard"]`; it adds pages to the dashboard and reads its data through its own package's command.

## Business logic

A widget's URL is the prefix `/_widgets`, the project's id, the package's name and the module's file name, each percent-encoded, so a scoped name like `@gemstack/skill-logs` stays one segment. A request is answered with the file only when all of these hold: it is a `GET` or `HEAD` (anything else is 405); the project id is registered; the package is a widget of that project (read afresh from the project's dependencies on every request, so installing or removing a package needs no restart); and the file lies inside the widget module's own directory, by the rules in `project-widgets.ts`. Everything else, including a malformed escape, is a 404 with no fallback page: widget URLs are asked for by the dashboard's loader, not typed by a person. A file is sent with the content type of its extension and `no-cache`, since a widget is rebuilt in place under the same name.
