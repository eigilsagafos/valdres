import { createKeyboardHub, type KeyboardHub } from "./keyboardHub"

// Weak so a discarded document (a removed iframe realm) releases its hub.
const hubs = new WeakMap<Document, KeyboardHub>()

// Resolved lazily on every call: importing this module reads no browser global.
const currentDocument = (): Document | undefined =>
    typeof document === "undefined" ? undefined : document

/** The current document's hub if it has been activated. Never activates. */
export const peekKeyboardHub = (): KeyboardHub | undefined => {
    const doc = currentDocument()
    return doc === undefined ? undefined : hubs.get(doc)
}

/**
 * Starts the current document's persistent hub, once. Idempotent. Without a
 * document (server, worker) it does nothing and records nothing, so a later
 * client call still activates.
 */
export const activateKeyboardHub = (): KeyboardHub | undefined => {
    const doc = currentDocument()
    if (doc === undefined) return undefined
    let hub = hubs.get(doc)
    if (hub === undefined) {
        hub = createKeyboardHub(doc)
        hubs.set(doc, hub)
    }
    return hub
}

/**
 * @internal Detaches and forgets the current document's hub so each test starts
 * unactivated. Package-private and never re-exported: the public lifetime has
 * no teardown.
 */
export const resetKeyboardHub = (): void => {
    const doc = currentDocument()
    if (doc === undefined) return
    hubs.get(doc)?.detach()
    hubs.delete(doc)
}
