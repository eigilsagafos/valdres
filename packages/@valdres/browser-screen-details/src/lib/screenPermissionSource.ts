import type { ExternalSource } from "valdres"
import type { ScreenPermissionState } from "../types/ScreenPermissionState"
import { readScreenPermission, retainScreenPermission } from "./screenDetailsRecord"

export const screenPermissionSource: ExternalSource<ScreenPermissionState> = {
    getSnapshot: readScreenPermission,
    getServerSnapshot: () => "prompt",
    subscribe: retainScreenPermission,
}
