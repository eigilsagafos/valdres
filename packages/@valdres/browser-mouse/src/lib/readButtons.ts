import type { MouseButtons } from "../types/MouseButtons"

// MouseEvent.buttons is a bitmask: 1 = primary (left), 2 = secondary (right),
// 4 = auxiliary (middle). See
// https://developer.mozilla.org/docs/Web/API/MouseEvent/buttons
export const readButtons = (buttons: number): MouseButtons => ({
    buttons,
    left: (buttons & 1) !== 0,
    right: (buttons & 2) !== 0,
    middle: (buttons & 4) !== 0,
})
