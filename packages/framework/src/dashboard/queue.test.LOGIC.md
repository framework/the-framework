What the tests cover, with a queue reader held in memory:

- **One block per project that has a queue, most entries first** - a project whose reader answers a queue is listed with its entries as given, an empty queue included; a project whose reader answers no queue is left out; the blocks are ordered by number of entries, descending.
- **Failures** - a project whose provider lookup throws is left out, one whose read throws lists no entries, and the other projects are still collected.
