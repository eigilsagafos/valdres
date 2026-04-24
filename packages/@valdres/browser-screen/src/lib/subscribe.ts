import { screenAtom } from "../atoms/screenAtom"
import { readScreen } from "./readScreen"

const update = () => screenAtom.setSelf(readScreen())

export const subscribe = () => {
    if (typeof window === "undefined") return
    update()
    window.addEventListener("resize", update)
    const orientation = window.screen?.orientation
    orientation?.addEventListener?.("change", update)

    // `(resolution: Xdppx)` only fires when crossing the exact threshold,
    // so rebind to the new DPR after each change.
    let dprMq: MediaQueryList | null = null
    const onDPRChange = () => {
        update()
        bindDPR()
    }
    const addMqListener = (mq: MediaQueryList, fn: () => void) => {
        if (mq.addEventListener) mq.addEventListener("change", fn)
        else mq.addListener?.(fn)
    }
    const removeMqListener = (mq: MediaQueryList, fn: () => void) => {
        if (mq.removeEventListener) mq.removeEventListener("change", fn)
        else mq.removeListener?.(fn)
    }
    const bindDPR = () => {
        if (typeof window.matchMedia !== "function") return
        if (dprMq) removeMqListener(dprMq, onDPRChange)
        dprMq = window.matchMedia(
            `(resolution: ${window.devicePixelRatio}dppx)`,
        )
        addMqListener(dprMq, onDPRChange)
    }
    bindDPR()

    return () => {
        window.removeEventListener("resize", update)
        orientation?.removeEventListener?.("change", update)
        if (dprMq) removeMqListener(dprMq, onDPRChange)
    }
}
