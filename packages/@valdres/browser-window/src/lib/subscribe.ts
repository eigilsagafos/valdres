import { windowSizeAtom } from "../atoms/windowSizeAtom"
import { readWindowSize } from "./readWindowSize"

const update = () => windowSizeAtom.setSelf(readWindowSize())

export const subscribe = () => {
    if (typeof window === "undefined") return
    update()
    window.addEventListener("resize", update)
    return () => {
        window.removeEventListener("resize", update)
    }
}
