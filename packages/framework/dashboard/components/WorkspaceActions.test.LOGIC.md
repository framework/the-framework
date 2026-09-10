What the tests cover:

- **Whose checkout is opened** - on an agent's page the folder button and the editor's "Open this agent's checkout" both open that agent's own checkout, never the project's tree, which would show code the agent did not write; on a project's page they open the project's checkout.
- **The same offer on both pages** - a project's page and an agent's page carry the same set of actions and the same repository link, so an agent's page is not missing the repository, the folder or the editor.
- **Choosing an editor** - picking a detected editor from the editor menu stores that editor's command in the preferences, picking "Default" clears the stored choice, and an editor stored by hand that was not detected still gets its own row in the menu.
