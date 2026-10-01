// Input types whose keys are not text entry, so a keydown there is not
// treated as typing.
const NON_TEXT_INPUT_TYPES = new Set([
    "button",
    "checkbox",
    "color",
    "file",
    "hidden",
    "image",
    "radio",
    "range",
    "reset",
    "submit",
])

/**
 * Whether a keydown was aimed at text entry. Reads the innermost composed
 * target, so a text field inside an open shadow root counts. Only meaningful
 * while the event is being dispatched: afterwards `composedPath()` is empty.
 */
export const isEditableTarget = (event: KeyboardEvent): boolean => {
    const target =
        (typeof event.composedPath === "function"
            ? event.composedPath()[0]
            : undefined) ?? event.target
    if (target === null || typeof target !== "object") return false
    const element = target as Partial<HTMLElement>
    if (typeof element.tagName !== "string") return false
    if (element.isContentEditable === true) return true
    switch (element.tagName.toUpperCase()) {
        case "TEXTAREA":
        case "SELECT":
            return true
        case "INPUT":
            return !NON_TEXT_INPUT_TYPES.has(
                String((element as HTMLInputElement).type).toLowerCase(),
            )
        default:
            return false
    }
}
