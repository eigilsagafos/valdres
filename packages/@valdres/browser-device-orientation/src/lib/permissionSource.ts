import type { ExternalSource } from "valdres"
import type { PermissionValue } from "../types/PermissionValue"
import { readOrientationPermission, retainOrientationPermission } from "./orientationPermission"

/** Server rendering and hydration: an unanswered prompt. */
export const PERMISSION_SERVER_VALUE: PermissionValue = "prompt"

export const permissionSource: ExternalSource<PermissionValue> = {
    getSnapshot: readOrientationPermission,
    getServerSnapshot: () => PERMISSION_SERVER_VALUE,
    subscribe: retainOrientationPermission,
}
