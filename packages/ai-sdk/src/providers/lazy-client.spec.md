Memoises a lazily-built SDK client so every provider's dynamic SDK import stays an optional dependency paid only on first use, with concurrent first calls sharing one construction.

## Facts

- The in-flight promise is cached (not just the resolved client), so two concurrent first calls share one build instead of racing to construct two.
- A failed import clears the cached promise on reject, so a transient failure doesn't poison later calls.
- `.set(client)` is the test seam used by nearly every provider suite to inject a fake client so the dynamic SDK import is never made (`client-construction.test.ts` is the exception that exercises the real path).
