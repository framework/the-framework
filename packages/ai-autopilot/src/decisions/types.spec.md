Types for the decisions ledger: `Decision` (frozen record), `DecisionSpec` (author-facing input), `DecisionStatus`, and `DecisionMatch` (a `consult` hit with score + shared-token `overlap` for explainability).

## Facts

- `DecisionStatus`: `rejected` (must not be re-proposed — the primary reason the ledger exists), `accepted` (committed choice), `superseded` (replaced via `supersededBy`; kept for history, not enforced).
