import { globalAtom } from "valdres"
import { subscribeInside } from "../lib/subscribeInside"

// Whether the cursor is geometrically within the document, tracked purely via
// mouseenter/mouseleave. This is independent of focus on purpose: alt-tabbing
// away with the cursor still over the page keeps this `true`, because the cursor
// really is still there. Compose with `@valdres/browser-focus` if you want a
// focus-gated "user is actively here" signal instead.
//
// There is no way to know the state before the first enter/leave event, so it
// starts `false` (also the SSR value).
export const mouseInsideAtom = globalAtom<boolean>(false, {
    name: "@valdres/browser-mouse/inside",
    onMount: () => subscribeInside(),
})
