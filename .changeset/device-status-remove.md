---
'@gemstack/the-framework': minor
'@gemstack/framework-dashboard': minor
---

Devices: online/offline status and remove-device in the "Run on" gear (#1072).

Each saved-device row in the gear gains a remove (X) control that drops the device; if the removed device was the selected run target, the selection clears back to a driver target. The gear device rows and the connection indicator now show a green (online) / grey (offline) reachability dot, and an offline row is muted and labelled. The device tokens stay browser-side (per #1052), so the browser hands the local daemon each device's {url, token} and the daemon does a cookie'd `GET /_relay/ping` to report reachable or not; a short client poll drives the dots. The new ping endpoint is cookie-guarded (401 without) and starts nothing.
