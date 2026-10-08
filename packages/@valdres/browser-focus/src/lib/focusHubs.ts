import { createFocusHub, type FocusHub } from "./focusHub"

// Weak so a discarded document (a removed iframe realm) releases its hub.
const hubs = new WeakMap<Document, FocusHub>()

export interface FocusHost {
    readonly document: Document
    readonly view: Window
}

/**
 * The current document and its window when focus can be observed, resolved on
 * every call so importing reads no browser global. Without either — a server,
 * a worker, a document with no browsing context — there is nothing to observe.
 */
export const resolveFocusHost = (): FocusHost | undefined => {
    if (typeof document === "undefined") return undefined
    if (typeof document.hasFocus !== "function") return undefined
    const view = document.defaultView
    if (view === null || typeof view?.addEventListener !== "function")
        return undefined
    return { document, view }
}

/** The host's attached hub, if a store tree currently retains one. */
export const peekFocusHub = (host: FocusHost): FocusHub | undefined =>
    hubs.get(host.document)

/**
 * Registers an invalidator on the host's hub, attaching it first if no store
 * tree holds it. The hub forgets itself when its last registration leaves.
 */
export const retainFocusHub = (
    host: FocusHost,
    invalidate: () => void,
): (() => void) => {
    let hub = hubs.get(host.document)
    if (hub === undefined) {
        const doc = host.document
        hub = createFocusHub(doc, host.view, () => hubs.delete(doc))
        hubs.set(doc, hub)
    }
    return hub.subscribe(invalidate)
}
