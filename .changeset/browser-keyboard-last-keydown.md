---
"@valdres/browser-keyboard": minor
---

Add `lastKeyDownAtom`, `lastKeyDownSelector(code)` and the `KeyDown` type, for
reacting to every keydown, auto-repeats included.

**`keyboardAtom` is now a read-only `Selector<KeyboardSnapshot>`** (it was an
`ExternalAtom<KeyboardSnapshot>`), and `lastKeyDownAtom` is a
`Selector<KeyDown | null>`. Both are projections of one internal source that
publishes held keys, locks and the latest keydown together, once per event. In
each store a keydown and the held keys after it therefore change in one
settlement: a `store.sub` `settle` handler triggered by a keydown sees that key
held, and ordinary subscribers see its writes in the same notification. This is
per store; separate stores settle independently. Code that typed a value as
`ExternalAtom` needs `Selector` instead; reads and subscriptions are unchanged.

The existing exports report held keys, so holding a key notifies once.
`lastKeyDownAtom` changes on every observed keydown and carries
`{ code, key, repeat, timeStamp, sequence }`. `sequence` increases with every
keydown and is never reset. `lastKeyDownSelector(code)` is that keydown when it
was `code`, and `null` once another key goes down. Both are `null` before the
first keydown, after a focus-loss reset and during server rendering. Keyups and
IME composition keydowns are not reported. The latest keydown is retained, not
queued: to run a command once per keydown, record the handled `sequence`.

Repeats notify nothing in stores that read only held-key state, but those stores
are now invalidated and re-read the source on each repeat (about 1.5 µs per
store per repeat measured in Happy-DOM). No native listener is added. Events
dispatched from inside a subscriber are applied after the current one, and at
most 64 events are applied per native event; beyond that a `RangeError` is
reported instead of the page hanging.
