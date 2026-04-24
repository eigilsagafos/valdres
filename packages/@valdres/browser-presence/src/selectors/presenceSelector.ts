import { selector } from "valdres"
import { focusAtom } from "@valdres/browser-focus"
import { isVisibleSelector } from "@valdres/browser-visibility"

export const presenceSelector = selector(
    get => get(isVisibleSelector) && get(focusAtom),
    { name: "@valdres/browser-presence/presence" },
)
