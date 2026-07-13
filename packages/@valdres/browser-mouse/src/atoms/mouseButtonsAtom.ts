import { atom } from "valdres"
import type { MouseButtons } from "../types/MouseButtons"
import { subscribeButtons } from "../lib/subscribeButtons"

const INITIAL: MouseButtons = Object.freeze({
    buttons: 0,
    left: false,
    right: false,
    middle: false,
})

export const mouseButtonsAtom = atom<MouseButtons>(INITIAL, {
    global: true,
    name: "@valdres/browser-mouse/buttons",
    onMount: () => subscribeButtons(),
})
