What the tests cover, for the question panel above the message box (`QuestionPanel.tsx`):

- **What it shows** - a region named by the question; a row per option with its label, "Recommended" on the recommended one, its description and its number; an "Other" field with the next number; Skip and Submit.
- **One answer** - the recommended option starts picked, and the first one when none is recommended; picking another row moves the pick and sends nothing; Submit sends the picked option for that project, question and agent.
- **After sending** - an accepted answer leaves the panel saying the answer was sent, with Submit, Skip, the rows and the field off; a refused one shows the daemon's words, no sent status, and Submit on again.
- **Keys** - on a panel not marked active a digit does nothing; on the active one a digit picks that row, the digit after the last option puts the cursor in "Other", and Ctrl+Enter submits the pick; a digit and Ctrl+Enter typed into another text field change and send nothing.
- **"Other"** - putting the cursor in it unpicks the option; empty, Submit is off; its trimmed words go as the user's message, not as a pick, and the page is told the text; Enter in the field submits.
- **Skip** - it sends "I skip this question." as the user's message; a refused skip shows the reason and tells the page nothing; an accepted one tells the page the text.
- **Several answers** - rows start checked per the question's defaults and are checked on and off; Submit sends the checked ones; with words in "Other", the checked labels and the words go together as one message and no pick.
