import { selector, type Selector } from "valdres"
import { focusAtom } from "@valdres/browser-focus"
import { isVisibleSelector } from "@valdres/browser-visibility"

/**
 * Both inputs are read on every evaluation, deliberately without `&&`
 * short-circuiting: a store tree that retains presence keeps both sources
 * attached for as long as it does, instead of releasing and re-sampling focus
 * on every tab switch.
 */
export const presenceSelector: Selector<boolean> = selector(
    get => {
        const visible = get(isVisibleSelector)
        const focused = get(focusAtom)
        return visible && focused
    },
    { name: "@valdres/browser-presence/presence" },
)
