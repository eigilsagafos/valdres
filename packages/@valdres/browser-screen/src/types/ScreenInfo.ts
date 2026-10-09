import type { ScreenOrientationType } from "./ScreenOrientationType"

/**
 * One coherent reading of `window.screen` and `window.devicePixelRatio`.
 * Snapshots are frozen and shared by every store that reads them, so the
 * fields are read-only.
 */
export interface ScreenInfo {
    readonly width: number
    readonly height: number
    readonly availWidth: number
    readonly availHeight: number
    readonly colorDepth: number
    readonly pixelDepth: number
    readonly devicePixelRatio: number
    readonly orientationType: ScreenOrientationType
    readonly orientationAngle: number
}
