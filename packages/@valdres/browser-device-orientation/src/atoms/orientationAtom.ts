import { globalAtom } from "valdres"
import type { GlobalAtom } from "valdres"
import type { OrientationSnapshot } from "../types/OrientationSnapshot"
import { subscribe } from "../lib/subscribe"

export const orientationAtom: GlobalAtom<OrientationSnapshot | null> =
    globalAtom<OrientationSnapshot | null>(null, {
        name: "@valdres/browser-device-orientation/orientation",
        onMount: () => subscribe(orientationAtom),
    })
