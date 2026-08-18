The dashboard's design gallery: static pages that show the design foundations (colors, status vocabulary, type, radii) and the app's building blocks in both themes, for design review outside the running app.

## TLDR

- Cards render the shipped components themselves against the app's own compiled stylesheet, so what the gallery shows is what the dashboard ships — silent drift between gallery and app is exactly what this exists to catch.
- The few surfaces that cannot render statically (popups that appear only at runtime) are hand-copied and visibly flagged as replicas.
- Cards are pure pages with nothing to click; hover and open states appear as separately rendered instances.
- The build turns the card registry into one page per card, each self-contained and showing light and dark side by side, ready for the design-sync upload.

## Before modifying/creating SPEC.md files

Always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
