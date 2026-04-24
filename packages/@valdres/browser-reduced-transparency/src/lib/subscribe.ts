import {
    REDUCED_TRANSPARENCY_MEDIA,
    reducedTransparencyAtom,
} from "../atoms/reducedTransparencyAtom"

export const subscribe = () => {
    if (typeof window === "undefined" || !window.matchMedia) return
    const mq = window.matchMedia(REDUCED_TRANSPARENCY_MEDIA)
    const sync = () =>
        reducedTransparencyAtom.setSelf(
            mq.matches ? "reduce" : "no-preference",
        )
    sync()
    mq.addEventListener("change", sync)
    return () => {
        mq.removeEventListener("change", sync)
    }
}
