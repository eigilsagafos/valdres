import type { ScreenDetail } from "../../types/ScreenDetail"
import { currentScreenAtom } from "../atoms/currentScreenAtom"
import { screenPermissionAtom } from "../atoms/screenPermissionAtom"
import { screensAtom } from "../atoms/screensAtom"
import { detailsState } from "../lib/detailsState"
import { toScreenDetail } from "../lib/toScreenDetail"

type ScreenLike = Parameters<typeof toScreenDetail>[0] & EventTarget

interface ScreenDetailsLike extends EventTarget {
    screens: ScreenLike[]
    currentScreen: ScreenLike
}

interface WindowWithScreenDetails {
    getScreenDetails?: () => Promise<ScreenDetailsLike>
}

export const requestScreenDetails = (): Promise<ScreenDetail[] | null> => {
    if (typeof window === "undefined") return Promise.resolve(null)
    const api = window as unknown as WindowWithScreenDetails
    if (typeof api.getScreenDetails !== "function")
        return Promise.resolve(null)
    if (detailsState.request) return detailsState.request

    detailsState.request = (async (): Promise<ScreenDetail[] | null> => {
        try {
            const details = await api.getScreenDetails!()
            screenPermissionAtom.setSelf("granted")

            const syncAll = () => {
                screensAtom.setSelf(details.screens.map(toScreenDetail))
                currentScreenAtom.setSelf(toScreenDetail(details.currentScreen))
            }
            const syncCurrent = () => {
                currentScreenAtom.setSelf(toScreenDetail(details.currentScreen))
            }

            const screenListeners = new Map<EventTarget, () => void>()
            const bindScreenListeners = () => {
                for (const [target, fn] of screenListeners) {
                    target.removeEventListener("change", fn)
                }
                screenListeners.clear()
                for (const screen of details.screens) {
                    const fn = () => syncAll()
                    screen.addEventListener("change", fn)
                    screenListeners.set(screen, fn)
                }
            }
            const onScreensChange = () => {
                bindScreenListeners()
                syncAll()
            }

            syncAll()
            bindScreenListeners()
            details.addEventListener("screenschange", onScreensChange)
            details.addEventListener("currentscreenchange", syncCurrent)

            return details.screens.map(toScreenDetail)
        } catch (err) {
            if (err instanceof DOMException && err.name === "NotAllowedError") {
                screenPermissionAtom.setSelf("denied")
            }
            detailsState.request = null
            throw err
        }
    })()

    return detailsState.request
}
