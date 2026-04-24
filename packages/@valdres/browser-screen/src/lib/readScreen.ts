import type { ScreenInfo } from "../../types/ScreenInfo"

const EMPTY: ScreenInfo = {
    width: 0,
    height: 0,
    availWidth: 0,
    availHeight: 0,
    colorDepth: 24,
    pixelDepth: 24,
    devicePixelRatio: 1,
    orientationType: "landscape-primary",
    orientationAngle: 0,
}

export const readScreen = (): ScreenInfo => {
    if (typeof window === "undefined" || !window.screen) return EMPTY
    const s = window.screen
    return {
        width: s.width,
        height: s.height,
        availWidth: s.availWidth,
        availHeight: s.availHeight,
        colorDepth: s.colorDepth,
        pixelDepth: s.pixelDepth,
        devicePixelRatio: window.devicePixelRatio,
        orientationType: s.orientation?.type ?? "landscape-primary",
        orientationAngle: s.orientation?.angle ?? 0,
    }
}
