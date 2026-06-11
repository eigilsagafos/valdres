<!-- DOCS:START -->

# hotkeys

Keyboard shortcuts from `keydown` / `keyup`. `subscribeToHotkey`/`Key`/`Code`/`Command` fire a callback on match; the live key/code combination is exposed as global atoms.

## Install

```bash
bun add @valdres/hotkeys
```

## Live example

▶ Live example: [https://valdres.dev/react/plugins/hotkeys](https://valdres.dev/react/plugins/hotkeys)

## Usage

React has a `useHotkeys` hook family. Every other framework calls `subscribeToHotkey(...)` inside its own effect primitive and returns the unsubscribe.

```tsx
import { useHotkeys } from "@valdres-react/hotkeys"

function Editor() {
    useHotkeys("meta+s", () => save(), { preventDefault: true })
    // also: useHotkeysKey, useHotkeysCode, useHotkeysCommand("Save", ...)
    return <textarea />
}
```

## Exports

| Export                       | Kind             | Type                                                                                             |
| ---------------------------- | ---------------- | ------------------------------------------------------------------------------------------------ |
| `currentCodeCombinationAtom` | atom (read-only) | `KeyboardCode[]` — `event.code`s currently held                                                  |
| `currentKeyCombinationAtom`  | atom (read-only) | `string[]` — lowercased `event.key`s currently held                                              |
| `eventByCodeAtom`            | atomFamily       | `(code: KeyboardCode[]) => Atom<KeyboardEvent \| null>`                                          |
| `eventByKeyAtom`             | atomFamily       | `(key: string[]) => Atom<KeyboardEvent \| null>`                                                 |
| `subscribeToHotkey`          | util fn          | `(hotkey: string, cb: (e: KeyboardEvent) => void, options: Options, store: Store) => () => void` |
| `subscribeToKey`             | util fn          | `(key: string \| string[], cb, options, store) => () => void`                                    |
| `subscribeToCode`            | util fn          | `(code: KeyboardCode \| KeyboardCode[], cb, options, store) => () => void`                       |
| `subscribeToCommand`         | util fn          | `(command: KeyboardCommand, cb, options, store) => () => void`                                   |
| `registerListeners`          | util fn          | `() => void` — attaches the document key listeners                                               |
| `eventHandler`               | util fn          | `(event: KeyboardEvent) => void`                                                                 |
| `DEFAULT_OPTIONS`            | const            | frozen `Options`                                                                                 |
| `Options`                    | type             | `{ keyup, keydown, enabled, enableOnFormTags, enableOnContentEditable, preventDefault, repeat }` |
| `KeyboardCode`               | type             | re-exported from `@valdres/browser-keyboard`                                                     |
| `KeyboardCommand`            | type             | `"Save" \| "Undo" \| "Redo" \| "Cut" \| "Copy" \| "ZoomIn" \| "ZoomOut" \| "ZoomReset"`          |

`enabled` accepts a `boolean`, `() => boolean`, `Atom<boolean>`, or `Selector<boolean>`. `subscribeToCommand` maps a command to the OS-specific chord (e.g. `Save` → `meta+s` on Apple, `ctrl+s` elsewhere).

## Cross-framework

The combination atoms are global — read them with the framework's primitive (`useValue` / `createValue` / `injectValue` / `watch`, or `store.get` / `store.sub`). The `subscribeToX` callbacks take `store` explicitly, so they work anywhere.

---

Full documentation: https://valdres.dev/react/plugins/hotkeys

<!-- DOCS:END -->
