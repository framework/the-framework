What the tests cover, for the "Run on" pick:

- **The chip's words** - as a chip, the button reads "This machine" while no device [1] is picked, between an icon and a chevron, and has the bordered, rounded look; with a device picked it reads the device's label, the same when that device is offline, and the label is cut short where it does not fit. A pick that names a removed device reads "This machine". With the dashboard open on a device's own daemon it reads that device's label, and "A device" when the device is not among the saved ones.
- **The chip's menu** - it lists "This machine", the saved device and "Add a device…"; a click on the device's row picks that device, and a click on "This machine" clears the pick without taking the browser anywhere.
- **Removal** - the `X` on a device's row removes the device and does not pick it.
- **The icon button** - as an icon button it shows no words and no chip look, its tooltip reads "Run on — Studio" for a picked device named Studio, and its menu picks a device the same way.

## Glossary

[1] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
