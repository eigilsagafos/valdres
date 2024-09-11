import { atom } from "valdres"
import { getSystemColorMode } from "./getSystemColorMode"
import { prefersColorSchemeDark } from "./prefersColorSchemeDark"
import type { ColorMode } from "../types/ColorMode"

export const colorMode = atom<ColorMode>(getSystemColorMode, {
    onInit: setSelf => {
        window
            ?.matchMedia(prefersColorSchemeDark)
            ?.addEventListener("change", () => {
                setSelf(getSystemColorMode())
            })
    },
    // onMount: setSelf => {
    //     const callback = event => setSelf(event.matches)
    //     const mediaWatcher = window?.matchMedia(query)
    //     if (mediaWatcher) {
    //         mediaWatcher.addEventListener("change", callback)
    //         return [mediaWatcher, callback] as [MediaQueryList, () => void]
    //     }
    // },
    // onUnmount: data => {
    //     if (data) {
    //         const [mediaWatcher, callback] = data
    //         mediaWatcher.removeEventListener("change", callback)
    //     }
    //     // window?.matchMedia(query).removeEventListener("change")
    //     // console.log("onUnmount", asdf)
    // },
})
