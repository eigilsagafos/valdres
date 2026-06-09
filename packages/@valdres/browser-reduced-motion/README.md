<!-- DOCS:START -->

# browser-reduced-motion

Reactive `(prefers-reduced-motion: reduce)` as a global atom plus a boolean selector.

## Install

```bash
bun add @valdres/browser-reduced-motion
```

## Live example

▶ Live example: [https://valdres.dev/react/plugins/browser-reduced-motion](https://valdres.dev/react/plugins/browser-reduced-motion)

## Usage

```tsx
import { useValue } from "valdres-react"
import { prefersReducedMotionSelector } from "@valdres/browser-reduced-motion"

function Banner() {
    const reduced = useValue(prefersReducedMotionSelector)
    return <div className={reduced ? "static" : "animated"} />
}
```

## Exports

| Export                         | Kind             | Type                                            |
| ------------------------------ | ---------------- | ----------------------------------------------- |
| `reducedMotionAtom`            | atom (read-only) | `ReducedMotion` (`"no-preference" \| "reduce"`) |
| `prefersReducedMotionSelector` | selector         | `boolean`                                       |
| `ReducedMotion`                | type             | `"no-preference" \| "reduce"`                   |

## Cross-framework

The atom is global: read it with each adapter's primitive (`useValue`, `createValue`, `injectValue`, `watch`) or `store.get` / `store.sub` in plain JS. The media-query subscription starts on the first subscriber and stops when the last one leaves.

---

Full documentation: https://valdres.dev/react/plugins/browser-reduced-motion

<!-- DOCS:END -->
