import type { Atom, Selector } from "valdres"

export type Options = {
    keyup: boolean
    keydown: boolean
    enabled: boolean | (() => boolean) | Atom<boolean> | Selector<boolean>
    enableOnFormTags: boolean
    enableOnContentEditable: boolean
    preventDefault: boolean
    repeat: boolean
}
