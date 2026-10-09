import { externalAtom, type ExternalAtom } from "valdres"
import { permissionSource } from "../lib/permissionSource"
import type { PermissionValue } from "../types/PermissionValue"

/** Never prompts. Subscribing only queries the Permissions API. */
export const permissionAtom: ExternalAtom<PermissionValue> = externalAtom(
    permissionSource,
    { name: "@valdres/browser-device-motion/permission" },
)
