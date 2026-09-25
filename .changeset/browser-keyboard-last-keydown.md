---
"@valdres/browser-keyboard": minor
---

Add `lastKeyDownAtom`, `lastKeyDownSelector(code)` and the `KeyDown` type, for
reacting to every keydown, auto-repeats included.

The existing exports report held keys, so holding a key notifies once. The new
atom changes on every observed keydown and carries
`{ code, key, repeat, timeStamp, sequence }`. `sequence` increases with every
keydown, so two keydowns never compare equal. `lastKeyDownSelector(code)` is
that keydown when it was `code`, and `null` once another key goes down. Both are
`null` before the first keydown, after a focus-loss reset and during server
rendering. Keyups and IME composition keydowns are not reported.

They share the existing listeners: no new native listener is added. Repeats
still cost nothing for stores that read only held-key state. A store reading
both is updated once per atom; the last keydown is updated first, so an
intermediate value pairs the keydown with the keys held just before it, never
new held keys with an older keydown. Events dispatched from inside a subscriber
are applied after the current one. At most 64 events are applied per native
event, so a subscriber that keeps dispatching keydowns is stopped with a
reported `RangeError` rather than hanging the page.
