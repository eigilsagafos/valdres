---
"@valdres/browser-keyboard": minor
---

`KeyboardCode` now lists every `KeyboardEvent.code` value from the W3C UI Events
KeyboardEvent code spec, plus `F13`–`F24`. It previously had 81 codes and left
out standard keys such as `PageUp`, `Insert`, `NumLock`, `ScrollLock`, `Pause`,
`PrintScreen` and all `Numpad*` codes. `isCodePressedSelector` and
`lastKeyDownSelector` also accept any other string, while still autocompleting
the listed codes.
