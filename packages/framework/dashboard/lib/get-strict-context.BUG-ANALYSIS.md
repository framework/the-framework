# Bug analysis: packages/framework/dashboard/lib/get-strict-context.tsx

## Business logic (high-level)

The strict-context factory (get-strict-context.SPEC.md): scoped state published for one region;
reading it outside that region throws immediately, naming the missing region, instead of handing
back nothing. Implementation is the standard pattern: `createContext<T | undefined>(undefined)`,
a Provider requiring `value: T`, and a consumer hook that throws on `undefined`.

Invariant audit:

- The error message interpolates the optional `name` ("useContext must be used within <name>"),
  falling back to "a Provider" — satisfies "naming the missing region" when callers pass a name;
  an anonymous factory still fails fast, just less helpfully. Matches the SPEC.
- The sentinel is `undefined`: a caller instantiating `getStrictContext<T>` where `undefined` is
  a *legitimate* value for T, and providing `value={undefined}`, would be misdiagnosed as
  "outside the provider". Callers in this codebase publish object values, so the sentinel is
  safe; reliance noted (a `Symbol` default would remove it, at the cost of complexity this
  project would reject).
- One context per factory call, closed over — two regions from two calls can never collide.
  Provider identity is stable per factory (created once at module scope by callers), so no
  remount churn.

## Functions (low-level)

- `getStrictContext<T>(name?)` — returns `[Provider, useSafeContext]` as const (tuple typing lets
  callers destructure with their own names). Provider: plain pass-through with optional children.
  Hook: throw-on-undefined, returns narrowed `T`. Edge cases: nested providers of the same
  context shadow correctly (React semantics); no memoization of `value` — consumers re-render on
  every provider render with a new object, which is the caller's concern, not this factory's.
  Verdict: correct.

## Bugs found

None found.
