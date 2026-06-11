<!-- DOCS:START -->

# browser-screen-details

Wraps the [Window Management API](https://developer.mozilla.org/en-US/docs/Web/API/Window_Management_API) (`window.getScreenDetails()`) as global atoms exposing the current screen, all connected screens, and the permission state.

> **Permission required**
>
>
> Screen details are empty until you call `requestScreenDetails()`, which prompts for the `window-management` permission. Requires a secure context.

## Install

```bash
bun add @valdres/browser-screen-details
```

## Live example

▶ Live example: [https://valdres.dev/react/plugins/browser-screen-details](https://valdres.dev/react/plugins/browser-screen-details)

## Usage

```tsx
import { useValue } from "valdres-react"
import {
    currentScreenAtom,
    screensAtom,
    screenPermissionAtom,
    requestScreenDetails,
} from "@valdres/browser-screen-details"

function Screens() {
    const permission = useValue(screenPermissionAtom)
    const current = useValue(currentScreenAtom)
    const screens = useValue(screensAtom)

    if (permission !== "granted")
        return <button onClick={() => requestScreenDetails()}>Allow screens</button>
    return (
        <div>
            {current?.label}: {current?.width} × {current?.height} ({screens.length} screens)
        </div>
    )
}
```

## Exports

| Export                  | Kind             | Type                                                                                                                                                                                    |
| ----------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `currentScreenAtom`     | atom (read-only) | `ScreenDetail \| null`                                                                                                                                                                  |
| `screensAtom`           | atom (read-only) | `ScreenDetail[]`                                                                                                                                                                        |
| `screenPermissionAtom`  | atom (read-only) | `ScreenPermissionState`                                                                                                                                                                 |
| `requestScreenDetails`  | util fn          | `() => Promise<ScreenDetail[] \| null>`                                                                                                                                                 |
| `ScreenDetail`          | type             | `{ label, left, top, width, height, availLeft, availTop, availWidth, availHeight, colorDepth, pixelDepth, devicePixelRatio, orientationType, orientationAngle, isPrimary, isInternal }` |
| `ScreenPermissionState` | type             | `"prompt" \| "granted" \| "denied" \| "unsupported"`                                                                                                                                    |

## Cross-framework

All state is global atoms, so it works in every framework — only the read primitive differs. The atoms stay empty until `requestScreenDetails()` resolves; call it once from anywhere.

---

Full documentation: https://valdres.dev/react/plugins/browser-screen-details

<!-- DOCS:END -->
