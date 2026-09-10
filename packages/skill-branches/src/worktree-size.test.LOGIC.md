What the tests cover:

- **A checkout's size** - the kilobytes `du` reports become bytes; a real directory reads as a positive size, or as unknown on a platform without `du`; a failed read and output that is not a number both read as unknown, never as a wrong number.
