What the tests cover for this machine's settings (`config.ts`).

- **`personal:`** - all parts on with no file and with a file that has no `personal` key; one part off leaves the others on; `off` and `False` turn a part off; `on`, `true` and no value leave it on; none of these says anything on the log. `Off` leaves that part on and is said; an unknown part (`plugins`) turns nothing off and is said with the list of parts; `personal: off`, not a map, turns nothing off and is said; a file YAML cannot parse turns nothing off and is said.
