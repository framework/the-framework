Vendored animate-ui file-tree primitives (`@ts-nocheck`): a multiple-open accordion specialized into Files/Folder/File slot components with a shared hover-highlight layer.

## TLDR

- `Files` = the accordion in `multiple` mode with `open`/`defaultOpen`/`onOpenChange` (string[] of open folder values) via `useControlledState`, exposed through a `FilesProvider`; `FolderItem` derives `isOpen` per folder through a `FolderProvider`.
- `FilesHighlight` pins the Highlight effect to `controlledItems` + `mode="parent"` + hover, so one animated background rectangle glides between hovered rows; `FolderHighlight`/`FileHighlight` are the per-row `HighlightItem`s.
- `FolderIcon` cross-fades closed/open icons via AnimatePresence keyed on `isOpen`; the rest (`File`, `FileIcon`, `FileLabel`, `Folder`, `FolderHeader`, `FolderTrigger`, `FolderPanel`, `FolderLabel`) are thin `data-slot` wrappers over the accordion/plain elements.
