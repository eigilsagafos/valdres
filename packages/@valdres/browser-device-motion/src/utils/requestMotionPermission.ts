import { requestMotionPermissionOnce } from "../lib/motionPermission"
import type { PermissionValue } from "../types/PermissionValue"

/**
 * The explicit permission trigger. Call it directly from a user gesture
 * handler (a click), before any `await`: the browser checks the gesture's
 * transient activation when the request starts. Never rejects:
 *
 * - `"granted"` / `"denied"`: the answer, recorded for every store;
 * - the current value when the request could not run (no user gesture, or a
 *   host failure): nothing is recorded, so a later gesture can retry;
 * - the current value when the browser has no `requestPermission`;
 * - `"unsupported"` without the API or in an insecure context.
 *
 * Concurrent calls share one request. A browser prompt cannot be cancelled.
 */
export const requestMotionPermission = (): Promise<PermissionValue> =>
    requestMotionPermissionOnce()
