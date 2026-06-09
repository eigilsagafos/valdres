<!-- DOCS:START -->

# browser-reduced-transparency

Read-only global atom + boolean selector for the `(prefers-reduced-transparency: reduce)` media query.

## Install

```bash
bun add @valdres/browser-reduced-transparency
```

## Live example

▶ Live example: [https://valdres.dev/react/plugins/browser-reduced-transparency](https://valdres.dev/react/plugins/browser-reduced-transparency)

Toggle "Reduce transparency" in your OS accessibility settings.

## Usage

```tsx
import { useValue } from "valdres-react"
import { prefersReducedTransparencySelector } from "@valdres/browser-reduced-transparency"

function Panel() {
    const reduce = useValue(prefersReducedTransparencySelector)
    return <div className={reduce ? "opaque" : "glass"} />
}
```

## Exports

| Export                               | Kind             | Type                          |
| ------------------------------------ | ---------------- | ----------------------------- |
| `reducedTransparencyAtom`            | atom (read-only) | `"no-preference" \| "reduce"` |
| `prefersReducedTransparencySelector` | selector         | `boolean`                     |
| `ReducedTransparency`                | type             | `"no-preference" \| "reduce"` |

## Cross-framework

Global state — only the read primitive's name changes per framework (`useValue`, `createValue`, `injectValue`, `watch`, or `store.get` / `store.sub` in plain JS). The media-query subscription starts on the first subscriber across all stores and stops when the last leaves.

---

Full documentation: https://valdres.dev/react/plugins/browser-reduced-transparency

<!-- DOCS:END -->
