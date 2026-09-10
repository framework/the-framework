What the tests cover, against the real editor:

- **Enter submits** - a plain Enter submits the prompt; Shift+Enter and Alt+Enter do not.
- **Cmd/Ctrl+Enter submits** - both Cmd+Enter and Ctrl+Enter submit.
- **An open menu owns Enter** - while a suggestion menu is open Enter does not submit (the menu uses it to pick); once the menu is closed Enter submits again.
- **IME composition is not a send** - an Enter that confirms an IME composition does not submit.
