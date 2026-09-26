What the tests cover for this machine's settings (`config.ts`).

- **`personal:`** - all parts off with no file and with a file that has no `personal` key; one part on leaves the others off; `on` and `True` turn a part on; `off`, `false` and no value leave it off; none of these says anything on the log. `On` leaves that part off and is said; an unknown part (`plugins`) turns nothing on and is said with the list of parts; `personal: on`, not a map, turns nothing on and is said; a file YAML cannot parse turns nothing on and is said.
