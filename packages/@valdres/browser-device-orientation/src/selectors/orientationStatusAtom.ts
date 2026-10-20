import { selector, type Selector } from "valdres"
import { orientationSourceAtom } from "../atoms/orientationSourceAtom"
import type { OrientationStatus } from "../types/OrientationStatus"

export const orientationStatusAtom: Selector<OrientationStatus> = selector(
    get => get(orientationSourceAtom).status,
    { name: "@valdres/browser-device-orientation/status" },
)
