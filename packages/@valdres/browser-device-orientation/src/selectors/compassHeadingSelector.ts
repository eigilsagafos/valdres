import { selector, type Selector } from "valdres"
import { orientationAtom } from "./orientationAtom"

// Prefers iOS's webkitCompassHeading (true compass) when available, falling
// back to alpha. Note: alpha is rarely an absolute compass on Android, so
// values may need calibration for compass-style use cases.
export const compassHeadingSelector: Selector<number | null> = selector(
    get => {
        const o = get(orientationAtom)
        if (!o) return null
        if (o.webkitCompassHeading !== null) return o.webkitCompassHeading
        return o.alpha
    },
    { name: "@valdres/browser-device-orientation/compassHeading" },
)
