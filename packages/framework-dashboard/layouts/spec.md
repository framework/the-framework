The Vike root layout and the app's global stylesheet.

## TLDR

- `LayoutDefault.tsx` — root layout: applies the theme preference by toggling `.dark` on `<html>` (#725) and wraps pages in the themed shell + ErrorBoundary (#1194).
- `tailwind.css` — Tailwind v4 entry: Everforest light/dark tokens (#1118/#1141), class-based `dark` variant, status/logo token families, rail-marquee + prompt-editor + scrollbar/scroll-fade CSS.
