import { selector, type Selector } from "valdres"
import { visibilityAtom } from "../atoms/visibilityAtom"

export const isVisibleSelector: Selector<boolean> = selector(
    get => get(visibilityAtom) === "visible",
    { name: "@valdres/browser-visibility/isVisible" },
)
