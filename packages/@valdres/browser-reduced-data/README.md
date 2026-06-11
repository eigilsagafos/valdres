<!-- DOCS:START -->

# browser-reduced-data

Wraps the `(prefers-reduced-data: reduce)` media query as a global atom, with a boolean selector.

## Install

```bash
bun add @valdres/browser-reduced-data
```

## Live example

▶ Live example: [https://valdres.dev/react/plugins/browser-reduced-data](https://valdres.dev/react/plugins/browser-reduced-data)

## Usage

```tsx
import { useValue } from "valdres-react"
import { prefersReducedDataSelector } from "@valdres/browser-reduced-data"

function Hero() {
    const reduced = useValue(prefersReducedDataSelector)
    return reduced ? <Poster /> : <Video />
}
```

## Exports

| Export                       | Kind             | Type                                          |
| ---------------------------- | ---------------- | --------------------------------------------- |
| `reducedDataAtom`            | atom (read-only) | `ReducedData` (`"no-preference" \| "reduce"`) |
| `prefersReducedDataSelector` | selector         | `boolean`                                     |
| `ReducedData`                | type             | `"no-preference" \| "reduce"`                 |

## Cross-framework

`reducedDataAtom` is a global atom; only the read primitive changes per framework (`useValue`, `createValue`, `injectValue`, `watch`, or `store.get` / `store.sub`). The browser subscription starts on the first subscriber and stops when the last leaves.

---

Full documentation: https://valdres.dev/react/plugins/browser-reduced-data

<!-- DOCS:END -->
