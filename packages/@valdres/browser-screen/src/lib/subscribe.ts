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
    const bindDPR = () => {
        if (typeof window.matchMedia !== "function") return
        dprMq?.removeEventListener("change", onDPRChange)
        dprMq = window.matchMedia(
            `(resolution: ${window.devicePixelRatio}dppx)`,
        )
        dprMq.addEventListener("change", onDPRChange)
    }
    bindDPR()

    return () => {
        window.removeEventListener("resize", update)
        orientation?.removeEventListener?.("change", update)
        dprMq?.removeEventListener("change", onDPRChange)
    }
}
