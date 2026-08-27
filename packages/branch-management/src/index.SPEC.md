The package's main entry point: it gathers the git runner, the naming and layout conventions, the checkout lifecycle, the checkout-as-an-agent-gets-it sequence, the dependency linking, the branch-name links, the reclaim rule, the command line and the executable's directory into one place for a caller to import. No business logic of its own. The naming conventions are also reachable on their own (`branch-names`), for code that runs in a browser and must not pull in git; and the skill's text (`SKILL.md`) is exported for a caller that puts it in an agent's prompt.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
