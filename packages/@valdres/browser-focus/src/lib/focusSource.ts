import type { ExternalSource } from "valdres"
import { peekFocusHub, resolveFocusHost, retainFocusHub } from "./focusHubs"
import { sampleWindowFocus } from "./sampleWindowFocus"

/**
 * Reported when focus cannot be observed — during server rendering and in
 * runtimes without a `document` and its window (server, worker). A page that is
 * rendering is assumed to be the one the user is looking at.
 */
export const FOCUS_UNAVAILABLE = true

export const focusSource: ExternalSource<boolean> = {
    // While any store tree retains the source, every read — retained or
    // dormant, in any store — reports what the window's events announced.
    // Otherwise a dormant read samples the same window-level state and
    // attaches nothing.
    getSnapshot: () => {
        const host = resolveFocusHost()
        if (host === undefined) return FOCUS_UNAVAILABLE
        return peekFocusHub(host)?.focused() ?? sampleWindowFocus(host.document)
    },
    getServerSnapshot: () => FOCUS_UNAVAILABLE,
    subscribe: invalidate => {
        const host = resolveFocusHost()
        if (host === undefined) return () => {}
        return retainFocusHub(host, invalidate)
    },
}
