import { activateKeyboardHub } from "../lib/keyboardHubs"

/**
 * Starts keyboard tracking for the current document now, instead of at the
 * first store subscription. Idempotent. Does nothing without a `document`
 * (server, worker), so it is safe to call from shared entry code. There is no
 * matching stop: once started, tracking lasts for the document's lifetime.
 */
export const activateKeyboard = (): void => {
    activateKeyboardHub()
}
