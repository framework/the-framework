Vendored animate-ui accordion primitive (`@ts-nocheck`): Base UI's Accordion wrapped with motion/react height+opacity+mask animations and strict React contexts.

## TLDR

- `Accordion` mirrors value state through `useControlledState` into an `AccordionProvider`; each `AccordionItem` derives `isOpen` from whether the accordion value includes its own value.
- `AccordionPanel` animates open/close via `motion.div` (height 0↔auto, opacity, y, and a `--mask-stop` CSS var driving a linear-gradient mask reveal); `keepRendered` keeps the panel mounted (animating in place) vs. AnimatePresence mount/unmount.
- Exports the `useAccordionItem` hook so styled layers (the files primitives) can read open state.
