What the tests cover:

- **Failure and retry** - when the stream image fails to load, the frame is replaced by the "not reachable" message with a "Retry" button; "Retry" brings the frame back on a fresh stream request rather than replaying the failed one, and the button goes away; a retry that fails again shows the message again and can be retried once more.
- **A failure belongs to one agent's stream** - switching the panel to another agent without remounting starts that agent's stream clean instead of inheriting the earlier failure; returning to an agent whose stream failed earlier tries its stream again instead of showing the remembered failure.
