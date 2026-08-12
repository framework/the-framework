A price list for every supported model, used to turn token counts into dollar amounts.

## TLDR

- Each price entry is dated so stale rates are auditable; apps with negotiated rates can override individual entries.
- Cost estimation returns zero for a model it doesn't know — an eval report must never crash on a fresh model.
- Budget enforcement takes the opposite stance: it demands a known price and fails when the app starts, because silently treating an unknown model as free would defeat spend caps.
- Also defines the errors for an unpriced model and for a user exceeding a spend cap.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
