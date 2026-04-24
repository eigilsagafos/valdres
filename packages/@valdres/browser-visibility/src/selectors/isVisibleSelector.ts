import { selector } from "valdres"
import { visibilityAtom } from "../atoms/visibilityAtom"

export const isVisibleSelector = selector(
    get => get(visibilityAtom) === "visible",
    { name: "@valdres/browser-visibility/isVisible" },
)
