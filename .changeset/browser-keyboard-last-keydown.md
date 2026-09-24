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
still cost nothing for stores that read only held-key state, and for one event
held-key state is updated before `lastKeyDown` subscribers are notified.
