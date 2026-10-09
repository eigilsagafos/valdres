import type { ExternalSource } from "valdres"
import type { PermissionValue } from "../types/PermissionValue"
import { readMotionPermission, retainMotionPermission } from "./motionPermission"

/** Server rendering and hydration: an unanswered prompt. */
export const PERMISSION_SERVER_VALUE: PermissionValue = "prompt"

export const permissionSource: ExternalSource<PermissionValue> = {
    getSnapshot: readMotionPermission,
    getServerSnapshot: () => PERMISSION_SERVER_VALUE,
    subscribe: retainMotionPermission,
}
