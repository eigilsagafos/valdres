<!-- DOCS:START -->

# browser-keyboard

Tracks which keys are currently held down, from the document's `keydown` / `keyup` events. Exposes the raw pressed keys plus selectors for codes, modifiers, and per-key checks.

## Live example

▶ Live example: [https://valdres.dev/react/plugins/browser-keyboard](https://valdres.dev/react/plugins/browser-keyboard)

Press and hold keys — the on-screen keyboard reflects `pressedCodesSelector` live.

## Install

```bash
bun add @valdres/browser-keyboard
```

## Usage

```tsx
import { useValue } from "valdres-react"
import { pressedCodesSelector, isCodePressedSelector } from "@valdres/browser-keyboard"

function Keys() {
    const codes = useValue(pressedCodesSelector) // KeyboardCode[]
    const shift = useValue(isCodePressedSelector("ShiftLeft"))
    return <span>{codes.join(" + ")}</span>
}
```

## Exports

| Export                        | Kind                   | Type             |
| ----------------------------- | ---------------------- | ---------------- |
| `pressedKeysAtom`             | atom (read-only)       | `PressedKey[]`   |
| `pressedCodesSelector`        | selector               | `KeyboardCode[]` |
| `pressedKeyValuesSelector`    | selector               | `string[]`       |
| `modifierSelector`            | selector               | `Modifier[]`     |
| `isCodePressedSelector(code)` | selector family        | `boolean`        |
| `isKeyPressedSelector(key)`   | selector family        | `boolean`        |
| `toggleKeyAtom(key)`          | atom family (settable) | `boolean`        |

## Cross-framework

Global atoms and selectors — works in every framework. For higher-level "press this combination → run this callback" hotkeys (rather than raw key state), use `@valdres/hotkeys`.

---

Full documentation: https://valdres.dev/react/plugins/browser-keyboard

<!-- DOCS:END -->
