import {
    REDUCED_MOTION_MEDIA,
    reducedMotionAtom,
} from "../atoms/reducedMotionAtom"

export const subscribe = () => {
    if (
        typeof window === "undefined" ||
        typeof window.matchMedia !== "function"
    )
        return
    const mq = window.matchMedia(REDUCED_MOTION_MEDIA)
    const sync = () =>
        reducedMotionAtom.setSelf(mq.matches ? "reduce" : "no-preference")
    sync()
    mq.addEventListener("change", sync)
    return () => {
        mq.removeEventListener("change", sync)
    }
}
