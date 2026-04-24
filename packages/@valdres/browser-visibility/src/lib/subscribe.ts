import { visibilityAtom } from "../atoms/visibilityAtom"

const sync = () => visibilityAtom.setSelf(document.visibilityState)
const onChange = () => visibilityAtom.setSelf(document.visibilityState)

export const subscribe = () => {
    if (typeof document === "undefined") return
    sync()
    document.addEventListener("visibilitychange", onChange)
    return () => {
        document.removeEventListener("visibilitychange", onChange)
    }
}
