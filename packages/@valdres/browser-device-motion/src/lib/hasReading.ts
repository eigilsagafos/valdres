import type { MotionSnapshot } from "../types/MotionSnapshot"

/**
 * Whether a `devicemotion` event carried values. Browsers only dispatch
 * these events once access is granted, but Chromium dispatches all-null events
 * where access is denied or no sensor exists, so only a reading with a value
 * counts as evidence of access.
 */
export const hasReading = (snapshot: MotionSnapshot): boolean =>
    [snapshot.acceleration, snapshot.accelerationIncludingGravity].some(
        vector => vector !== null && (vector.x !== null || vector.y !== null || vector.z !== null),
    ) ||
    (snapshot.rotationRate !== null &&
        (snapshot.rotationRate.alpha !== null ||
            snapshot.rotationRate.beta !== null ||
            snapshot.rotationRate.gamma !== null))
