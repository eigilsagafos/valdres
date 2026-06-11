<!-- DOCS:START -->

# browser-contrast

Wraps the `prefers-contrast` media query as a global atom (`"no-preference" | "more" | "less" | "custom"`), plus boolean selectors for the `more`/`less` cases.

## Install

```bash
bun add @valdres/browser-contrast
```

## Live example

▶ Live example: [https://valdres.dev/react/plugins/browser-contrast](https://valdres.dev/react/plugins/browser-contrast)

## Usage

```tsx
import { useValue } from "valdres-react"
import { contrastAtom, prefersMoreContrastSelector } from "@valdres/browser-contrast"

function ContrastBadge() {
    const contrast = useValue(contrastAtom)
    const more = useValue(prefersMoreContrastSelector)
    return <span data-high-contrast={more}>{contrast}</span>
}
```

## Exports

| Export                        | Kind             | Type                                              |
| ----------------------------- | ---------------- | ------------------------------------------------- |
| `contrastAtom`                | atom (read-only) | `Contrast`                                        |
| `prefersMoreContrastSelector` | selector         | `boolean`                                         |
| `prefersLessContrastSelector` | selector         | `boolean`                                         |
| `Contrast`                    | type             | `"no-preference" \| "more" \| "less" \| "custom"` |

## Cross-framework

`contrastAtom` is global: identical in every framework, only the read primitive's name changes (`useValue`, `createValue`, `injectValue`, `watch`, or `store.get` / `store.sub` in plain JS). The browser subscription starts on the first subscriber across all stores and stops when the last leaves.

---

Full documentation: https://valdres.dev/react/plugins/browser-contrast

<!-- DOCS:END -->
