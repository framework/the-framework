What the tests cover: reading a project's shared custom presets yields nothing when the file is missing or its contents are not valid JSON, and never fails; saved presets read back unchanged; saving validates first — entries without an identifier, without prompt text, or reusing an identifier already taken are dropped, and labels and prompt text are trimmed; saving un-ignores the presets file in the project's `.the-framework/.gitignore` so git tracks it, adding that line only once no matter how many times presets are saved; saving an empty list still writes the file and keeps the un-ignore line.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
