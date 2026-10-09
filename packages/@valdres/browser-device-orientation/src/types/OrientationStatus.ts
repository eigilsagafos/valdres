/**
 * - `"unsupported"`: no `window` or no `DeviceOrientationEvent` (server, worker,
 *   browsers without the API).
 * - `"insecure"`: `window.isSecureContext` is `false`; the API is restricted to
 *   secure contexts, so nothing is attached.
 * - `"idle"`: supported, and no store tree is listening.
 * - `"active"`: at least one store tree retains the source, so one
 *   `deviceorientation` listener is attached. Readings may still be `null`: the
 *   device has no sensor, permission is not granted yet, or the page is hidden.
 */
export type OrientationStatus = "unsupported" | "insecure" | "idle" | "active"
