import { selector } from "valdres"
import { focusAtom } from "@valdres/browser-focus"
import { visibilityAtom } from "@valdres/browser-visibility"

export const presenceSelector = selector(
    get => get(visibilityAtom) === "visible" && get(focusAtom),
    { name: "@valdres/browser-presence/presence" },
)
