import { mousePositionAtom } from "../atoms/mousePositionAtom"

const update = (event: MouseEvent) =>
    mousePositionAtom.setSelf({
        clientX: event.clientX,
        clientY: event.clientY,
        pageX: event.pageX,
        pageY: event.pageY,
        screenX: event.screenX,
        screenY: event.screenY,
    })

// There is no API to read the cursor position without an event, so the atom
// keeps its zeroed initial value until the first `mousemove`.
export const subscribePosition = () => {
    if (typeof window === "undefined") return
    window.addEventListener("mousemove", update)
    return () => {
        window.removeEventListener("mousemove", update)
    }
}
