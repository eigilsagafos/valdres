import type { ScreenDetail } from "../types/ScreenDetail"

interface ScreenLike {
    label?: string
    left?: number
    top?: number
    width: number
    height: number
    availLeft?: number
    availTop?: number
    availWidth: number
    availHeight: number
    colorDepth: number
    pixelDepth: number
    devicePixelRatio?: number
    orientation?: { type: OrientationType; angle: number }
    isPrimary?: boolean
    isInternal?: boolean
}

export const toScreenDetail = (screen: ScreenLike): ScreenDetail => ({
    label: screen.label ?? "",
    left: screen.left ?? 0,
    top: screen.top ?? 0,
    width: screen.width,
    height: screen.height,
    availLeft: screen.availLeft ?? 0,
    availTop: screen.availTop ?? 0,
    availWidth: screen.availWidth,
    availHeight: screen.availHeight,
    colorDepth: screen.colorDepth,
    pixelDepth: screen.pixelDepth,
    devicePixelRatio:
        screen.devicePixelRatio ??
        (typeof window !== "undefined" ? window.devicePixelRatio : 1),
    orientationType: screen.orientation?.type ?? "landscape-primary",
    orientationAngle: screen.orientation?.angle ?? 0,
    isPrimary: screen.isPrimary ?? true,
    isInternal: screen.isInternal ?? true,
})
