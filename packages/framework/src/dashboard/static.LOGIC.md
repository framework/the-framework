Serves the built dashboard from its directory as plain files with an app-shell fallback: the requested file when one exists inside the directory, otherwise `index.html`, so a client-side route or an unknown path still boots the dashboard. `content-type.ts` supplies the content type by file extension.

## Business logic — TL;DR

- **The file, or the app shell** - a path that names a real file inside the bundle directory is served as that file, while the root, any other path, a path that would escape the directory, a malformed percent-escape and an unparseable request target are all served as `index.html`, so nothing outside the bundle is ever read and a bad request never takes the daemon down.
- **A missing bundle is a 404** - when even `index.html` cannot be read, the answer is 404 "dashboard bundle not built".
- **Caching** - `index.html` must always be revalidated (`no-cache`), while every other file is a fingerprinted asset cached as immutable for a year.
