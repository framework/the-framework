Tests of the one case the RPC tests cannot stage (`run-inbox.ts`): an agent that ends while a line is on its way to it. A throwaway git repository with a real checkout, the `branches` skill's package as its branches provider, a real resume hook line, and the "is it working" answer scripted.

Covered:
- A line written to an agent that was working at the check and ended by the second look is taken back out of the inbox and resumes the agent instead, after an earlier line the agent never took, in order; nothing is left in the inbox.
- A line written to an agent that is still working at the second look stays in the inbox, and the resume hook is not run.
