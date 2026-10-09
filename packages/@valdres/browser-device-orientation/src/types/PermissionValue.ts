/**
 * - `"granted"` / `"denied"`: answered by a permission request or reported by
 *   the Permissions API (`accelerometer` and `gyroscope`, Chromium).
 * - `"prompt"`: `DeviceOrientationEvent.requestPermission` exists and no answer is
 *   known yet — call `requestOrientationPermission()` from a user gesture.
 * - `"unsupported"`: no `DeviceOrientationEvent`, or an insecure context.
 *
 * Browsers without `requestPermission` and without a Permissions API answer
 * deliver events without asking, and report `"granted"`.
 */
export type PermissionValue = "granted" | "denied" | "prompt" | "unsupported"
