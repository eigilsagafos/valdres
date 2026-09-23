<!-- DOCS:START -->

# browser-keyboard

Tracks which keys are currently held down, from the document's `keydown` / `keyup`
events. Exposes one immutable keyboard snapshot plus selectors for codes, key
values, modifiers, per-key checks and lock keys.

Keyboard state belongs to the browser, so `keyboardAtom` is an **external atom**:
it is read-only, and everything else is a selector derived from it. Stores cannot
write any of them — `set`, `reset` and `update` reject them at compile time and at
runtime.

## Live example

▶ Live example: [https://valdres.dev/react/plugins/browser-keyboard](https://valdres.dev/react/plugins/browser-keyboard)

Press and hold keys — the on-screen keyboard reflects `pressedCodesSelector` live.

## Install

```bash
bun add @valdres/browser-keyboard
```

## Usage

Every read works through a store, with no adapter at all:

```ts
import { store } from "valdres"
import {
    pressedCodesSelector,
    modifierSelector,
    toggleKeyAtom,
} from "@valdres/browser-keyboard"

const app = store()
const stop = app.sub(pressedCodesSelector, () => {
    console.log(app.get(pressedCodesSelector)) // e.g. ["ShiftLeft", "KeyA"]
})
app.get(modifierSelector("shift")) // boolean
app.get(toggleKeyAtom("CapsLock")) // boolean | null — null until observed
stop() // removes this store's subscription; tracking continues
```

```tsx
import { useValue } from "valdres-react"
import { pressedCodesSelector, isCodePressedSelector } from "@valdres/browser-keyboard"

function Keys() {
    const codes = useValue(pressedCodesSelector) // string[]
    const shift = useValue(isCodePressedSelector("ShiftLeft"))
    return <span>{codes.join(" + ")}</span>
}
```

`useValue` reads the store provided by the nearest `<Provider store={…}>`, or one
you pass explicitly as its second argument. There is no implicit global store.

> **Adapter support in this beta**
>
> `valdres-react` is the only adapter migrated to the v1 core. The Vue, Svelte,
> Solid and Angular adapters cannot read an external atom yet. Until they ship,
> read this package with `store.get` / `store.sub` as above.

## Exports

| Export                                                                    | Kind                        | Type                                 |
| ------------------------------------------------------------------------- | --------------------------- | ------------------------------------ |
| `keyboardAtom`                                                            | external atom (read-only)   | `KeyboardSnapshot`                   |
| `pressedKeysAtom`                                                         | selector (read-only)        | `readonly PressedKey[]`              |
| `pressedCodesSelector`                                                    | selector                    | `string[]`                           |
| `pressedKeyValuesSelector`                                                | selector                    | `string[]` (lowercased `key` values) |
| `modifierSelector(modifier)`                                              | selector family             | `boolean`                            |
| `isCodePressedSelector(code)`                                             | selector family             | `boolean`                            |
| `isKeyPressedSelector(key)`                                               | selector family             | `boolean` (case-insensitive)         |
| `toggleKeyAtom(key)`                                                      | selector family (read-only) | `boolean \| null`                    |
| `KeyboardSnapshot`, `PressedKey`, `KeyboardCode`, `Modifier`, `ToggleKey` | types                       |                                      |

`pressedKeysAtom` and `toggleKeyAtom` keep their pre-v1 names, but they are
read-only selectors now.

`keyboardAtom`'s value is a frozen `{ pressed, locks }` object. `pressed` lists held
keys in press order as `{ code, key, timeStamp, target }`, where `timeStamp` and
`target` come from the keydown that first observed the press — repeats do not
replace it. An event that changes nothing (a repeat, releasing an untracked key)
keeps the same snapshot object, so nothing downstream is notified.

## What is observed

Tracking covers events observed since the keyboard hub started — the platform
cannot list keys already held before then. Only a key's own `keydown` makes it
pressed; modifier flags on other events (`ctrlKey`, `metaKey`, …) are never used
to infer presses.

- **Focus loss resets.** When the window loses focus or the page becomes hidden,
  keyups can be missed, so every pressed key is cleared and every lock returns to
  `null`.
- **Lock keys** (`CapsLock`, `NumLock`, `ScrollLock`) are reported only through
  `toggleKeyAtom`, never as pressed keys. All three are read together from the
  first accepted event after start or a reset; after that, a lock updates when its
  own key is pressed or released.
- **IME composition** keydowns (`isComposing`, or the legacy `keyCode` 229) are
  ignored. A keyup during composition still releases a key that was already held.
- **macOS Command.** macOS does not send keyup for keys pressed while Command is
  held. On Apple platforms each new keydown drops the keys pressed after Command,
  and releasing Command clears every key.
- **Propagation.** The listeners are on `document` in the bubbling phase. An event
  stopped before it reaches `document` is not observed.

## Lifetime

One persistent listener set per document — `keydown`, `keyup` and
`visibilitychange` on the document, `blur` on its window — shared by every store.

- **Importing and reading never start it.** A `store.get` before the hub has
  started reports the empty snapshot.
- **The first store subscription starts it** — directly to `keyboardAtom` or
  through any selector derived from it.
- **Once started, it keeps tracking.** Unsubscribing, unmounting or disposing a
  store only removes that store's subscription. Key state is not cleared and the
  listeners stay attached, so a store that subscribes later sees the keys held now.
  With no store subscribed, events only update the snapshot; no store does work.

Each store tree registers once, however many subscribers and child scopes read
the keyboard. When one store's subscriber throws, the other stores are still
notified, and the error is reported from the native event listener.

## Server rendering

On the server — and in any runtime without a `document` — every read returns one
fixed empty snapshot: no pressed keys, every lock `null`. Server rendering never
starts the hub. During hydration `useValue` renders that same empty value first,
then switches to the live keyboard state: a normal two-pass render, not a
hydration mismatch.

## Keyboard state versus shortcuts

This package reports **state**: which keys are held. Store notifications are not
the native event, so they cannot call `preventDefault()` or react to a single
event such as a repeat. For "press this combination → run this callback"
shortcuts, handle the native event: add your own `keydown` listener, or use
`@valdres/hotkeys`, which has not been migrated to the v1 core yet.

---

Full documentation: https://valdres.dev/react/plugins/browser-keyboard

<!-- DOCS:END -->
