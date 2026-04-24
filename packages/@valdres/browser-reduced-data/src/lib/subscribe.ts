import {
    REDUCED_DATA_MEDIA,
    reducedDataAtom,
} from "../atoms/reducedDataAtom"

export const subscribe = () => {
    if (typeof window === "undefined" || !window.matchMedia) return
    const mq = window.matchMedia(REDUCED_DATA_MEDIA)
    const sync = () =>
        reducedDataAtom.setSelf(mq.matches ? "reduce" : "no-preference")
    sync()
    mq.addEventListener("change", sync)
    return () => {
        mq.removeEventListener("change", sync)
    }
}
