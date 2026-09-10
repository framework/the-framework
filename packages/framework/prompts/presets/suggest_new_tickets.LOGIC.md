The "Suggest new tickets" preset of the launcher, a single line the dashboard prefills into the composer for the user to edit freely: the agent [1] suggests new tickets and writes each one with `tickets put <DATE>_<SLUG>.md`, in the ticket format the `tickets` skill [2] gives, after seeing the existing tickets through `tickets list` so it proposes nothing that is already there. It takes no parameter, and it asks the user nothing: a proposal is a reviewable ticket, so the user triages it afterwards.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] skill: one of the four capabilities an agent is taught (`branches`, `tickets`, `queue`, `logs`), each a package with the instructions the agent reads, a command on the agent's PATH, and an API the product calls.
