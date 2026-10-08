/**
 * Whether `doc`'s own window is the focused browsing context right now: the
 * document has focus and it is not delegated to a nested browsing context
 * (an iframe, frame or object). This is the state the window's `focus` and
 * `blur` events announce: focus entering a nested frame blurs this window even
 * though `document.hasFocus()` keeps returning `true`, so `hasFocus()` alone
 * would disagree with the events whenever a frame holds focus.
 *
 * Focus inside an open shadow root is followed to the element that holds it;
 * a frame inside a closed shadow root is invisible here and reads as focused.
 */
export const sampleWindowFocus = (doc: Document): boolean => {
    if (!doc.hasFocus()) return false
    // `undefined` on minimal hosts that do not implement `activeElement`.
    let active: Element | null | undefined = doc.activeElement
    while (active?.shadowRoot?.activeElement)
        active = active.shadowRoot.activeElement
    if (active == null) return true
    return (active as Partial<HTMLIFrameElement>).contentWindow == null
}
