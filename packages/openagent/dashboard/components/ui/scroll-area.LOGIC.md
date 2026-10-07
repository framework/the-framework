Provides the dashboard's scrolling box: a vertical scroll region with its own thin scrollbar that belongs to the layout, present the whole time the content overflows and darkening under the pointer, so a list that holds more than it shows says so, unlike the operating system's overlay bar that hides itself. When the content fits, there is no bar at all. It scrolls vertically only.

## Business logic — TL;DR

- **A bar only while the content overflows** - the scrollbar is shown the whole time the content is taller than the box and removed entirely when the content fits, so a short list has no bar.
- **Keyboard scrolling without a focus ring** - the scrolled region takes keyboard focus so the arrow and page keys scroll it, but draws no focus outline, since a scroll region is not a control.
- **The height cap belongs to the scrolled region** - a host either lets the region fill a box of definite height, or caps the region's own height when the box has none (a menu, the prompt editor), which is what makes the content scroll instead of growing; a host may also take hold of the scrolled element to scroll it itself, as the views rail does.
