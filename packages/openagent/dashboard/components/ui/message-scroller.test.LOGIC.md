What the tests cover:

- **The feed's scrollbar styling** - the scrolling view asks for a thin scrollbar toned like the rest of the dashboard, a stable scrollbar gutter, a faded bottom edge, and a scrollbar that stays quiet while the view is following the live edge.
- **Every styling utility it asks for exists** - each scrollbar and fade utility the view names is one that the dashboard's own stylesheet (`tailwind.css`) defines, so none of them can silently be nothing.
