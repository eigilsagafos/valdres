import { atom } from "valdres"
import type { MousePosition } from "../types/MousePosition"
import { subscribePosition } from "../lib/subscribePosition"

// MouseEvent exposes no way to read the cursor position up front, so the atom
// starts zeroed and fills in on the first `mousemove`.
const INITIAL: MousePosition = Object.freeze({
    clientX: 0,
    clientY: 0,
    pageX: 0,
    pageY: 0,
    screenX: 0,
    screenY: 0,
})

export const mousePositionAtom = atom<MousePosition>(INITIAL, {
    global: true,
    name: "@valdres/browser-mouse/position",
    onMount: () => subscribePosition(),
})
