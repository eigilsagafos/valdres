<!-- DOCS:START -->

# browser-keyboard

Tracks which keys are currently held down, from the document's `keydown` / `keyup`
events. Two read-only external atoms hold the observed state — held keys and
locks in `keyboardAtom`, the most recent keydown in `lastKeyDownAtom` — and every
other export is a selector derived from one of them.

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
    toggleKeySelector,
} from "@valdres/browser-keyboard"

const app = store()
const stop = app.sub(pressedCodesSelector, () => {
    console.log(app.get(pressedCodesSelector)) // e.g. ["ShiftLeft", "KeyA"]
})
app.get(modifierSelector("shift")) // boolean
app.get(toggleKeySelector("CapsLock")) // boolean | null — null until observed
stop() // removes this store's subscription; tracking continues
```

```tsx
import { useValue } from "valdres-react"
import { pressedCodesSelector, modifierSelector } from "@valdres/browser-keyboard"

function Keys() {
    const codes = useValue(pressedCodesSelector) // readonly string[]
    const shift = useValue(modifierSelector("shift")) // boolean
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

## API

Everything is read-only browser truth. `set`, `reset` and `update` reject every
export below, at compile time and at runtime.

### Source

```ts
const keyboardAtom: ExternalAtom<KeyboardSnapshot>
```

Held keys and locks as one frozen snapshot. The pressed-key, per-key and lock
selectors below all derive from it, so one event can never leave pressed keys and
locks out of step.
An event that changes nothing — a repeat, releasing a key that was not tracked —
keeps the same snapshot object, and nothing downstream is notified.

### Activation

```ts
function activateKeyboard(): void
```

Starts tracking for the current document now. Without this call, tracking starts
at the first store subscription. Call it from your client entry when keys pressed
before the first component mounts matter, or when you only read with `store.get`.
It is idempotent, returns nothing because there is nothing to stop, and does
nothing where there is no `document`, so shared server/client entry code can call
it.

```ts
// client entry
import { activateKeyboard } from "@valdres/browser-keyboard"
activateKeyboard()
```

### Pressed keys

```ts
const pressedKeysSelector: Selector<readonly PressedKey[]>
const pressedCodesSelector: Selector<readonly string[]>
const pressedKeyValuesSelector: Selector<readonly string[]>
```

Held keys in press order: full entries, their physical `code`s
(`"ShiftLeft"`, `"KeyA"`), or their lowercased `key` values (`"shift"`, `"a"`).
`code` names the physical key regardless of layout; `key` is what the layout and
modifiers produced for the keydown that pressed it.

### Per-key checks

```ts
function isCodePressedSelector(code: KeyboardCode | (string & {})): Selector<boolean>
function isKeyPressedSelector(key: string): Selector<boolean> // case-insensitive
function modifierSelector(modifier: Modifier): Selector<boolean>
```

`modifierSelector` is true while either side of the modifier is held —
`"shift"` covers `ShiftLeft` and `ShiftRight`. Each family returns the same
selector for the same argument.

### Lock keys

```ts
function toggleKeySelector(key: ToggleKey): Selector<boolean | null>
```

Whether `CapsLock`, `NumLock` or `ScrollLock` is on, as of the last observed key
event. `null` means unknown: nothing observed yet, or a focus-loss reset since.

### Key downs, repeats included

```ts
const lastKeyDownAtom: ExternalAtom<KeyDown | null>
function lastKeyDownSelector(code: KeyboardCode | (string & {})): Selector<KeyDown | null>
```

Every other export reports held keys, so holding a key down notifies once. These
two change on **every** observed keydown, auto-repeats included. Subscribe to them
to act once per keydown, for example moving a selection while an arrow key is
held:

```ts
const stop = app.sub(lastKeyDownSelector("ArrowDown"), () => {
    if (app.get(lastKeyDownSelector("ArrowDown")) !== null) moveSelectionDown()
})
```

`lastKeyDownAtom` is the most recent keydown of any key. `lastKeyDownSelector(code)`
is that keydown when it was `code`, and `null` once a different key goes down.
Both are `null` before the first keydown and after a focus-loss reset. Keyups and
IME composition keydowns are not reported. Modifier and lock keydowns are — but
lock keys may not send a keydown for every press: on macOS, for example, CapsLock
may report turning on as a keydown and turning off as a keyup.

Repeats cost nothing for stores that read only held-key state: those stores are
not notified or re-evaluated.

A store that reads both held-key state and the last keydown is updated once for
each, so it settles twice per event. The last keydown is updated first, so in
between a selector sees the new keydown with the keys held **just before** it —
the modifiers held for a shortcut, but not yet the key itself — and never the new
held keys with an older keydown. A selector like "Shift is held and ArrowDown was
the last keydown" therefore fires only for an ArrowDown pressed while Shift is
down. After a focus-loss reset, the last keydown is cleared first as well.

A store notification is not the native event: it cannot call `preventDefault()`
and does not know which element had focus. For shortcuts that need either, handle
the native `keydown` event.

### Types

```ts
type KeyboardSnapshot = Readonly<{
    pressed: readonly PressedKey[]
    locks: Readonly<Record<ToggleKey, boolean | null>>
}>

type PressedKey = Readonly<{
    code: string
    key: string
    timeStamp: number // of the keydown that first pressed it; repeats keep it
}>

type KeyDown = Readonly<{
    code: string
    key: string
    repeat: boolean // true for an auto-repeat of a held key
    timeStamp: number
    sequence: number // +1 per observed keydown, never reset
}>

type Modifier = "shift" | "ctrl" | "alt" | "meta"
type ToggleKey = "CapsLock" | "NumLock" | "ScrollLock"
type KeyboardCode = "KeyA" | "Digit1" | "ShiftLeft" | "PageUp" | "Numpad0" | … // every UI Events code
```

`KeyboardCode` lists every `KeyboardEvent.code` value defined by the
[UI Events KeyboardEvent code spec](https://www.w3.org/TR/uievents-code/), plus
`F13`–`F24`, so editors autocomplete them. Selectors that take a code accept any
other string too, for codes outside that list.

## What is observed

Tracking covers events observed since the keyboard hub started — the platform
cannot list keys already held before then. Only a key's own `keydown` makes it
pressed; modifier flags on other events (`ctrlKey`, `metaKey`, …) are never used
to infer presses.

- **Focus loss resets.** When the window loses focus or the page becomes hidden,
  keyups can be missed, so every pressed key is cleared, every lock returns to
  `null`, and the last keydown returns to `null`.
- **Lock keys** are reported only through `toggleKeySelector`, never as pressed
  keys. All three are read together from the first event after start or a reset;
  after that, a lock updates when its own key is pressed or released.
- **IME composition** keydowns (`isComposing`, or the legacy `keyCode` 229) are
  ignored. A keyup during composition still releases a key that was already held.
- **macOS Command.** macOS does not send keyup for keys pressed while Command is
  held. On Apple platforms each new keydown drops the non-modifier keys pressed
  after Command, and releasing Command clears every non-modifier key. Modifiers
  still get their keyups, so a held Shift (Cmd+Shift+Z) or the other Command key
  stays pressed.
- **Propagation.** The listeners are on `document` in the bubbling phase. An event
  stopped before it reaches `document` is not observed.

## Lifetime

One persistent listener set per document — `keydown`, `keyup` and
`visibilitychange` on the document, `blur` on its window — shared by every store.

- **Importing and reading never start it.** A `store.get` before the hub has
  started reports the empty snapshot; after it has started, a `store.get` reports
  the current keys without subscribing.
- **`activateKeyboard()` or the first store subscription starts it**, whichever
  comes first. A subscription counts whether it is to `keyboardAtom`,
  `lastKeyDownAtom` or any selector derived from them.
- **Once started, it keeps tracking.** Unsubscribing, unmounting or disposing a
  store only removes that store's subscription. Key state is not cleared and the
  listeners stay attached, so a store that subscribes later sees the keys held now.
  With no store subscribed, events only update the snapshot; no store does work.

Each store tree registers once per atom it reads (`keyboardAtom`,
`lastKeyDownAtom`), however many subscribers and child scopes read them. Events
are applied one at a time: a key event or blur dispatched from inside a subscriber
is applied after the current event has updated both atoms. At most 64 events are
applied per native event; if subscribers keep dispatching more, the rest are
dropped and a `RangeError` is reported instead of hanging the page. When one
store's subscriber throws, the other stores are still notified, and the error is
reported from the native event listener.

## Server rendering

On the server — and in any runtime without a `document` — every read returns one
fixed empty snapshot: no pressed keys, every lock `null`, no last keydown. Server
rendering never starts the hub, and `activateKeyboard()` does nothing there.
During hydration `useValue` renders that same empty value first, then switches to
the live keyboard state: a normal two-pass render, not a hydration mismatch.

## Keyboard state versus shortcuts

This package reports **state**: which keys are held, and the last keydown. Store
notifications are not the native event, so they cannot call `preventDefault()` or
tell which element had focus. For "press this combination → run this callback",
handle the native `keydown` event yourself.

---

Full documentation: https://valdres.dev/react/plugins/browser-keyboard

<!-- DOCS:END -->
