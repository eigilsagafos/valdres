import { externalAtom, type ExternalAtom } from "valdres"
import { permissionSource } from "../lib/permissionSource"
import type { PermissionValue } from "../types/PermissionValue"

/**
 * The `"geolocation"` permission. Never prompts: subscribing only queries the
 * Permissions API and follows its `change` events.
 */
export const permissionAtom: ExternalAtom<PermissionValue> = externalAtom(
    permissionSource,
    { name: "@valdres/browser-geolocation/permission" },
)
