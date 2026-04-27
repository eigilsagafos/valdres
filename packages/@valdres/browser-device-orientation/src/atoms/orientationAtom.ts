import { atom } from "valdres"
import type { GlobalAtom } from "valdres"
import type { OrientationSnapshot } from "../../types/OrientationSnapshot"
import { subscribe } from "../lib/subscribe"

export const orientationAtom: GlobalAtom<OrientationSnapshot | null> =
    atom<OrientationSnapshot | null>(null, {
        global: true,
        name: "@valdres/browser-device-orientation/orientation",
        onMount: () => subscribe(orientationAtom),
    })
