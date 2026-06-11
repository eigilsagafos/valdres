<!-- DOCS:START -->

# browser-screen

Wraps `window.screen` as one global atom, synced on `resize`, `orientationchange`, and DPR changes.

## Install

```bash
bun add @valdres/browser-screen
```

## Live example

▶ Live example: [https://valdres.dev/react/plugins/browser-screen](https://valdres.dev/react/plugins/browser-screen)

## Usage

```tsx
import { useValue } from "valdres-react"
import { screenAtom } from "@valdres/browser-screen"

function Resolution() {
    const s = useValue(screenAtom)
    return <span>{s.width} × {s.height}</span>
}
```

## Exports

| Export       | Kind             | Type                                                                                                                      |
| ------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `screenAtom` | atom (read-only) | `ScreenInfo`                                                                                                              |
| `ScreenInfo` | type             | `{ width, height, availWidth, availHeight, colorDepth, pixelDepth, devicePixelRatio, orientationType, orientationAngle }` |

All fields are `number` except `orientationType: OrientationType`. Outside the browser the atom returns a fallback (zeros for dimensions; `colorDepth`/`pixelDepth` 24, `devicePixelRatio` 1, `orientationType: "landscape-primary"`).

The browser subscription starts on the first subscriber across all stores and stops when the last one leaves.

---

Full documentation: https://valdres.dev/react/plugins/browser-screen

<!-- DOCS:END -->
