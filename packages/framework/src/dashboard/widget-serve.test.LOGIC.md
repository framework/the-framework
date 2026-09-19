Tests of serving a widget's files (`widget-serve.ts`), through a real HTTP server over a throwaway project on disk.

Covered:
- A widget's URL encodes its scoped package name as one segment; its module is served with a JavaScript content type and `no-cache`, and its stylesheet beside it is served too.
- A path climbing out of the widget's directory, a dependency that brings no widget, an unknown project, a URL naming no file and a malformed escape are all 404; a `POST` is 405.
