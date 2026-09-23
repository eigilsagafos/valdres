import { globalAtom } from "valdres"
import type { MouseButtons } from "../types/MouseButtons"
import { subscribeButtons } from "../lib/subscribeButtons"

const INITIAL: MouseButtons = Object.freeze({
    buttons: 0,
    left: false,
    right: false,
    middle: false,
})

export const mouseButtonsAtom = globalAtom<MouseButtons>(INITIAL, {
    name: "@valdres/browser-mouse/buttons",
    onMount: () => subscribeButtons(),
})
