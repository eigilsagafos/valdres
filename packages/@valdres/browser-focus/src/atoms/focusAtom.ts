import { externalAtom, type ExternalAtom } from "valdres"
import { focusSource } from "../lib/focusSource"

export const focusAtom: ExternalAtom<boolean> = externalAtom(focusSource, {
    name: "@valdres/browser-focus/focus",
})
