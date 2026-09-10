What the tests cover, against throwaway daemons answering the ping:

- **Reachable or not, per device** - each device's id maps to whether its daemon answered: one answering with success is reachable, one refusing (an unauthorized answer) is not, and one with nothing listening is not.
- **Bad input** - no devices yields an empty answer; malformed entries from the browser are dropped rather than pinged and never appear in it.
