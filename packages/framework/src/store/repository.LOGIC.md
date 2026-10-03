Creates a project's repository on a host, for a project that lives on this machine only, through whichever package declares it can: The Framework names no host and runs no host's tool.

## Context

**User story**: in the project menu of a project with no remote, the user picks "Create a repository on GitHub…", confirms, and the project is on GitHub, private, pushed. The item is not there for a project that has a remote, or when the host cannot be reached as the user.

**Business logic story**: a package declares `"framework": { "repository": "<command>" }` in its `package.json`. The built-in GitHub package declares it (`../built-in.ts`), so a project with nothing installed is offered it too; a project's own package wins.

## Business logic — TL;DR

- **The offer** - the provider's `create --check` names the repository the project would become and the host; no provider, or a refusal, is no offer.
- **Creating** - the provider's `create` creates it and answers its address; a refusal comes back in the provider's own words.

## Business logic

### The offer

#### Context

See `## Context`.

#### Business logic

The provider's command is run in the project with `create --check`. When it answers a repository (`<account>/<name>`) and the host's name, that is the offer. No package providing the kind, a command that refuses (the project has a remote already, the host cannot be reached), or an answer without those two fields is no offer.

### Creating

#### Context

See `## Context`.

#### Business logic

The provider's command is run in the project with `create`. Its answer's `url` is the repository's address. A project with no provider is refused with "no package of this project creates a repository"; a command that fails is answered with its own last error line; an answer with no address is "<command> created no repository".
