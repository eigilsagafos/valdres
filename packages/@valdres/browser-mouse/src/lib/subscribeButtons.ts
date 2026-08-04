import { mouseButtonsAtom } from "../atoms/mouseButtonsAtom"
import { readButtons } from "./readButtons"

// The bitmask guard is a perf optimization, not a correctness requirement: the
// core already deep-equals writes and no-ops unchanged ones, so notifications
// never churn. What the guard avoids is the wasted work of allocating a fresh
// object (via `readButtons`) and running that deep compare on every `mousemove`
// pixel — a plain number comparison short-circuits all of it.
const sync = (event: MouseEvent) => {
    if (event.buttons !== mouseButtonsAtom.getSelf().buttons)
        mouseButtonsAtom.setSelf(readButtons(event.buttons))
}

// Clears everything when the window loses focus (alt-tab, devtools, releasing
// the mouse outside the page) — situations where no further mouse event will
// arrive to resync the state. Left unguarded on purpose: blur is rare, and the
// core deep-equals the write, so resetting when already idle is a silent no-op.
const reset = () => mouseButtonsAtom.setSelf(readButtons(0))

// `mousedown` / `mouseup` give immediate press/release transitions. `mousemove`
// resyncs after an event we never saw — most importantly the right-click
// `mouseup` swallowed by the native context menu, which would otherwise leave
// the button stuck. The press still shows while the menu is open; it clears on
// the first move once the menu is dismissed.
export const subscribeButtons = () => {
    if (typeof window === "undefined") return
    window.addEventListener("mousedown", sync)
    window.addEventListener("mouseup", sync)
    window.addEventListener("mousemove", sync)
    window.addEventListener("blur", reset)
    return () => {
        window.removeEventListener("mousedown", sync)
        window.removeEventListener("mouseup", sync)
        window.removeEventListener("mousemove", sync)
        window.removeEventListener("blur", reset)
    }
}
