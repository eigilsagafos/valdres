import { globalAtom } from "valdres"
import type { GlobalAtom } from "valdres"
import {
    subscribePermission,
    type PermissionValue,
} from "../lib/subscribePermission"

export const permissionAtom: GlobalAtom<PermissionValue> =
    globalAtom<PermissionValue>("prompt", {
        name: "@valdres/browser-geolocation/permission",
        onMount: () => subscribePermission(permissionAtom),
    })
