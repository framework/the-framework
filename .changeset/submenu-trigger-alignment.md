---
'@gemstack/the-framework': patch
---

Menu rows that open a submenu now line up with the rest of the menu. The row justified its contents to spread the chevron to the far end, which also spread everything before it, so a trigger whose label was plain text had that label pushed toward the middle while every ordinary row sat left. The chevron now moves itself to the end instead, which leaves the label where it belongs and makes the two ways of writing a trigger behave the same. Visible on "Open in editor" and, in a repo with several servable apps, "Serve".
