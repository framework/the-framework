Flattens a message's content — which may mix text with images and documents — down to plain text, keeping only the text pieces in order.

## TLDR

- Images and documents carry no text, so they simply drop out.
- The caller chooses what glues the pieces, on purpose: providers rebuild the wire message with nothing injected, while memory extraction inserts line breaks so text on either side of a dropped image doesn't jam into one word.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
