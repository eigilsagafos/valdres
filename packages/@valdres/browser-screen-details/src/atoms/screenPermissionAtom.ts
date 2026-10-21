import { externalAtom, type ExternalAtom } from "valdres"
import { screenPermissionSource } from "../lib/screenPermissionSource"
import type { ScreenPermissionState } from "../types/ScreenPermissionState"

/** Never prompts: subscribing only queries the Permissions API. */
export const screenPermissionAtom: ExternalAtom<ScreenPermissionState> =
    externalAtom(screenPermissionSource, {
        name: "@valdres/browser-screen-details/permission",
    })
