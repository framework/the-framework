# Bug analysis: packages/framework/dashboard/lib/document-title.ts

## Business logic (high-level)

The browser-tab title (#695/U3, document-title.SPEC.md): `(count) project — The Framework`, each
part dropping out when empty — no `(0)`, no dangling "—" without a project. The composition rules
in `frameworkTitle` match the SPEC and are pinned by the sibling test for all four combinations.

`useDocumentTitle` writes it in an effect keyed on `[needsYou, projectName]` — re-runs exactly
when the inputs change; the `typeof document === 'undefined'` guard covers non-DOM renders. No
cleanup restoring a previous title on unmount: the hook is mounted once at App level for the
lifetime of the page, so nothing ever needs the old title back — fine for this app.

Edge cases: negative counts never occur (a count of things); `projectName: ''` is falsy and
drops the scope part — the right reading; a project name containing "—" just reads naturally.

## Functions (low-level)

- `frameworkTitle(needsYou, projectName?)` — pure string builder; `needsYou > 0` gates the
  prefix, truthiness gates the scope. Verdict: correct.
- `useDocumentTitle(needsYou, projectName?)` — see above. Verdict: correct.

## Bugs found

None found.
