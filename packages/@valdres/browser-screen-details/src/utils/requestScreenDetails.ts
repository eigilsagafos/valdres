import { requestScreenDetailsOnce } from "../lib/screenDetailsRecord"
import type { ScreenDetail } from "../types/ScreenDetail"

/**
 * The explicit trigger: calls `window.getScreenDetails()`, which may show the
 * browser's `window-management` prompt. The native call is made
 * synchronously, inside the caller's task, so a call from a click handler
 * reaches the browser during that click; how the prompt is presented is the
 * browser's decision.
 *
 * - Resolves the screens when access is granted; `screenDetailsAtom` turns
 *   `"ready"` for every store.
 * - Rejects with the browser's error otherwise; the state turns `"denied"` for
 *   a `NotAllowedError` and `"error"` for anything else.
 * - Resolves `null` without the API or in an insecure context.
 *
 * Concurrent calls share one request; a browser prompt cannot be cancelled.
 *
 * Errors: never throws. The promise settles only with the browser's outcome;
 * a store subscriber that throws while the state is published is reported
 * through `globalThis.reportError` (or thrown in a later task), never turned
 * into a rejection, and the request is never retried. A denial the browser
 * reported after this request started keeps the state "denied" even though
 * the promise resolves with what the browser returned.
 */
export const requestScreenDetails = (): Promise<ScreenDetail[] | null> =>
    requestScreenDetailsOnce()
