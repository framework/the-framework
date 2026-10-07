Tests of serving a module's files (`module-serve.ts`), through a real HTTP server over a throwaway project on disk.

Covered:
- A module's URL encodes its scoped package name as one segment; its module is served with a JavaScript content type and `no-cache`, and its stylesheet beside it is served too.
- A path climbing out of the module's directory, a dependency that brings no module, an unknown project, a URL naming no file and a malformed escape are all 404; a `POST` is 405.
