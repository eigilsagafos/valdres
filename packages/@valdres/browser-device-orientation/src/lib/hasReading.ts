import type { OrientationSnapshot } from "../types/OrientationSnapshot"

/**
 * Whether a `deviceorientation` event carried values. Browsers only dispatch
 * these events once access is granted, but Chromium dispatches all-null events
 * where access is denied or no sensor exists, so only a reading with a value
 * counts as evidence of access.
 */
export const hasReading = (snapshot: OrientationSnapshot): boolean =>
    snapshot.alpha !== null || snapshot.beta !== null || snapshot.gamma !== null
