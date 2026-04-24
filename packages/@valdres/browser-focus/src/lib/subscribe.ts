import { focusAtom } from "../atoms/focusAtom"

const sync = () => focusAtom.setSelf(document.hasFocus())
const onFocus = () => focusAtom.setSelf(true)
const onBlur = () => focusAtom.setSelf(false)

export const subscribe = () => {
    if (typeof window === "undefined") return
    sync()
    window.addEventListener("focus", onFocus)
    window.addEventListener("blur", onBlur)
    return () => {
        window.removeEventListener("focus", onFocus)
        window.removeEventListener("blur", onBlur)
    }
}
