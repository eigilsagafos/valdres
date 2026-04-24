import { atom } from "valdres"
import type { GlobalAtom } from "valdres"
import {
    subscribePermission,
    type PermissionValue,
} from "../lib/subscribePermission"

export const permissionAtom: GlobalAtom<PermissionValue> =
    atom<PermissionValue>("prompt", {
        global: true,
        name: "@valdres/browser-geolocation/permission",
        onInit: () => subscribePermission(permissionAtom),
    })
