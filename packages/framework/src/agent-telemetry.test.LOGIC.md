What the tests cover:

- **The session opening** - it records the driver, the checkout, that the driver is not the fake one, and the model the driver was started with; when no model was chosen none is recorded, because the coding agent's own default is not knowable.
- **The session id at turn start** - the driver's announcement of its session id at the start of a turn is consumed rather than forwarded, and a session update is emitted at once, carrying the link template resolved with the id; a turn's result repeating the announced id emits no second update; a result carrying an id never announced still emits an update.
- **The cloud anchor** - a turn's result carrying the anchor commit emits it as its own event; a result without one, which is every driver whose work stays on this machine, emits none.
