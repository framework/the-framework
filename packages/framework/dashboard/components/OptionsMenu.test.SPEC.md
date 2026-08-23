What the tests cover: the gear marks that options are on with a dot rather than a number, and names the count only on hover; toggling an option writes its new value through; a row that cannot be switched is greyed, states its reason in place, and writes nothing when clicked.

The "Run on" list: it is one flat list — the three run targets, then the saved devices, then "Add a device…" — with no section header and no separate duplicate row for the local machine; it is absent entirely where no run target can be chosen (a composer inside a running agent), and its device half is absent when no saved devices are available. "Claude web" is a real, selectable target.

The single checkmark: it follows the chosen run target while no device is selected; selecting a device moves it onto that device and quiets the run-target rows; being connected to a remote daemon puts it on that daemon's device. Choosing any run target also clears a selected device, so the mark never appears twice.

Device rows: clicking one selects it as the run target without navigating anywhere and without writing a preference; its remove control drops the saved device without also selecting it; an unreachable device is dimmed and its address annotated "offline", while a reachable one shows its status dot and is not dimmed; "Add a device…" opens the add flow.

"This machine": on the local daemon it writes the run target and clears any selected device; while connected to a remote daemon it instead returns to the local daemon and writes no run target.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
