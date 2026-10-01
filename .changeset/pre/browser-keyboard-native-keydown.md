---
"@valdres/browser-keyboard": minor
---

**The native keydown, from inside a store update.** A store update caused by a
keydown runs while that keydown is still being dispatched; the package now lets
it act on that, without keeping any DOM object in state.

- **New `preventKeyDownDefault(keyDown)`** cancels the native keydown that
  produced `keyDown`, but only while it is still being dispatched — from a
  `settle` handler or a subscriber that the keydown caused. For a `lastKeyDown`
  read later, a different keydown, a non-cancelable event, a keydown dispatched
  from inside a subscriber (applied after its own dispatch), or on the server, it
  does nothing and returns `false`. Repeated calls from any store are harmless.
- **New `latestKeyDownSequence()`**: the `sequence` of the latest observed
  keydown (0 before any, and on the server). It is never one keydown behind
  while that keydown is still being delivered to other stores, and a focus-loss
  reset does not lower it, so it is the watermark a handler should start from.
  The documented `handled` pattern now starts there instead of at 0.
- **`KeyDown.editable`**: whether the keydown was aimed at text entry (textarea,
  select, text-like input, contenteditable, through open shadow roots), read
  when the event arrived.
- **`KeyDown.defaultPrevented`**: whether something had already cancelled the
  keydown when the keyboard's listener received it — element, capture-phase and
  root-level framework handlers, and `document` listeners added before the
  keyboard's. It is a snapshot taken before any store is updated: later
  listeners and stores that call `preventKeyDownDefault` never change it, so
  every store sees the same value.

**`KeyDown` objects you construct need the two new fields.** Runtime values come
from the package and always carry them, but a `KeyDown` literal in your own code
or tests (`{ code, key, repeat, timeStamp, sequence }`) no longer type-checks,
and `toEqual` comparisons against such a literal no longer match. Add
`editable` and `defaultPrevented`.
