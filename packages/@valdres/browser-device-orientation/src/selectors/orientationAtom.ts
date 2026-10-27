import { selector, type Selector } from "valdres"
import { orientationSourceAtom } from "../atoms/orientationSourceAtom"
import type { OrientationSnapshot } from "../types/OrientationSnapshot"

/**
 * The latest `deviceorientation` reading, or `null`. Subscribing attaches the
 * window's shared listener; it never prompts. A read-only Selector.
 */
export const orientationAtom: Selector<OrientationSnapshot | null> = selector(
    get => get(orientationSourceAtom).orientation,
    { name: "@valdres/browser-device-orientation/orientation" },
)
