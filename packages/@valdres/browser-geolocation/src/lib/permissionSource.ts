import type { ExternalSource } from "valdres"
import type { PermissionValue } from "../types/PermissionValue"
import {
    readGeolocationPermission,
    retainGeolocationPermission,
} from "./geolocationPermission"

/** Server rendering and hydration: an unanswered prompt. */
export const PERMISSION_SERVER_VALUE: PermissionValue = "prompt"

export const permissionSource: ExternalSource<PermissionValue> = {
    getSnapshot: readGeolocationPermission,
    getServerSnapshot: () => PERMISSION_SERVER_VALUE,
    subscribe: retainGeolocationPermission,
}
