Covers SKILL.md parsing: a valid document yields the manifest and trimmed body, while missing metadata, broken YAML, absent required fields, and names that would be mangled later each fail with a pointed error; unknown fields are dropped, body-less documents are fine, and errors carry the source label.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
