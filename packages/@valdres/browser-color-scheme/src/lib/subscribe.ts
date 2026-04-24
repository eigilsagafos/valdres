import { COLOR_SCHEME_MEDIA, colorSchemeAtom } from "../atoms/colorSchemeAtom"

export const subscribe = () => {
    if (
        typeof window === "undefined" ||
        typeof window.matchMedia !== "function"
    )
        return
    const mq = window.matchMedia(COLOR_SCHEME_MEDIA)
    const sync = () => colorSchemeAtom.setSelf(mq.matches ? "dark" : "light")
    sync()
    mq.addEventListener("change", sync)
    return () => {
        mq.removeEventListener("change", sync)
    }
}
