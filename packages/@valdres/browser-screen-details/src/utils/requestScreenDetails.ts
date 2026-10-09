import { requestScreenDetailsOnce } from "../lib/screenDetailsRecord"
import type { ScreenDetail } from "../types/ScreenDetail"

/**
 * The explicit trigger: calls `window.getScreenDetails()`, which may show the
 * browser's `window-management` prompt. Call it from a user gesture; the call
 * is made synchronously so that gesture's activation is kept.
 *
 * - Resolves the screens when access is granted; `screenDetailsAtom` turns
 *   `"ready"` for every store.
 * - Rejects with the browser's error otherwise; the state turns `"denied"` for
 *   a `NotAllowedError` and `"error"` for anything else.
 * - Resolves `null` without the API or in an insecure context.
 *
 * Concurrent calls share one request; a browser prompt cannot be cancelled.
 */
export const requestScreenDetails = (): Promise<ScreenDetail[] | null> =>
    requestScreenDetailsOnce()
