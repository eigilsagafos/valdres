import type { ExternalSource } from "valdres"
import type { PageVisibility } from "../types/PageVisibility"

/**
 * Reported when visibility cannot be observed — during server rendering and in
 * runtimes without a `document` (server, worker). A page that is rendering is
 * assumed to be on screen, which is also what keeps `isVisibleSelector`-gated
 * work running on the server.
 */
export const VISIBILITY_UNAVAILABLE: PageVisibility = "visible"

/** Resolved on every call, never at import: importing reads no browser global. */
const observedDocument = (): Document | undefined => {
    if (typeof document === "undefined") return undefined
    if (typeof document.visibilityState !== "string") return undefined
    if (typeof document.addEventListener !== "function") return undefined
    return document
}

export const visibilitySource: ExternalSource<PageVisibility> = {
    getSnapshot: () => {
        const doc = observedDocument()
        if (doc === undefined) return VISIBILITY_UNAVAILABLE
        // The standard defines only these two states. A legacy "prerender"
        // page is not on screen, so anything but "visible" reads as hidden.
        return doc.visibilityState === "visible" ? "visible" : "hidden"
    },
    getServerSnapshot: () => VISIBILITY_UNAVAILABLE,
    subscribe: invalidate => {
        const doc = observedDocument()
        if (doc === undefined) return () => {}
        doc.addEventListener("visibilitychange", invalidate)
        return () => doc.removeEventListener("visibilitychange", invalidate)
    },
}
