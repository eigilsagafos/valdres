---
"@valdres/browser-keyboard": minor
---

**Breaking: keyboard state is now read-only, persistent browser truth.**

The package was built on `globalAtom`, `onMount` and `setSelf`, none of which
exist in the v1 core, so the previously published build cannot import against a
current core. It is rebuilt on the public `externalAtom` primitive.

- **New `keyboardAtom`**, an `ExternalAtom<KeyboardSnapshot>`: one frozen
  `{ pressed, locks }` snapshot. Every selector derives from it, so one event
  never leaves pressed keys and lock state out of step, and an event that
  changes nothing keeps the same snapshot object.
- **Renamed:** `pressedKeysAtom` → `pressedKeysSelector` and
  `toggleKeyAtom(key)` → `toggleKeySelector(key)`. Both were always derived
  state; they are read-only selectors now. `set`, `reset` and `update` reject
  every export at compile time and throw `TypeError` at runtime.
- **`PressedKey` is data only:** `Readonly<{ code, key, timeStamp }>`. The DOM
  `target` field is removed, so snapshots never retain elements.
  `pressedCodesSelector` and `pressedKeyValuesSelector` return readonly arrays.
- **Persistent tracking.** One listener set per document (`keydown`, `keyup`,
  `visibilitychange`, window `blur`), shared by every store. It starts at the
  first store subscription or at the new `activateKeyboard()`, whichever comes
  first, and then keeps tracking: unsubscribing, unmounting or disposing a store
  only removes that store's subscription. Previously the last unsubscribe
  detached the listeners and cleared key state. With no store subscribed, events
  update the snapshot and no store does work.
- **`activateKeyboard(): void`** starts tracking early, from a client entry,
  before the first component subscribes. Idempotent; a no-op without a
  `document`. Importing the package and reading from it never start tracking.
- **Focus loss resets.** Window blur and the page becoming hidden clear pressed
  keys and return every lock to `null` (unknown until the next key event).
- **Error isolation.** When one store's subscriber throws, every other store is
  still notified; the failure is reported from the native event listener.
- **IME:** a keyup during composition now releases a key held before composition
  began, instead of leaving it pressed until the next reset.
- **Server rendering.** Every read without a `document` returns one fixed empty
  snapshot, including the `getServerSnapshot` React hydrates against.
- **Minimum core.** The `valdres` peer range is now `^1.0.0-beta.40`.
- **First release through the shared publish pipeline.** This is also where
  three fixes the certified packages already shipped reach this package: ESM
  declarations with explicit `.js` import specifiers, published metadata for
  CommonJS `require(esm)` and legacy TypeScript resolution, and no `workspace:`
  protocol in published dependency ranges.

`valdres-react` is the only framework adapter that can read an external atom
today; with the other adapters, read this package through `store.get` /
`store.sub`.
