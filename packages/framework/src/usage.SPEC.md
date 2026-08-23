Keeps a running total of what one agent spent — input, output and cache tokens, the cost, and how many turns produced it — so every surface can show the agent's usage and a budget cap has something to gate on. This is the agent's own spend only; where the account's subscription quota stands is reported separately by the driver.

A turn that reports no price still counts its tokens but leaves the cost total alone, so an agent that never priced a single turn totals no cost at all rather than reading as having been free; a cost appears the moment one turn reports one.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
