import type { ScreenDetail } from "../types/ScreenDetail"

const KEYS = [
    "label",
    "left",
    "top",
    "width",
    "height",
    "availLeft",
    "availTop",
    "availWidth",
    "availHeight",
    "colorDepth",
    "pixelDepth",
    "devicePixelRatio",
    "orientationType",
    "orientationAngle",
    "isPrimary",
    "isInternal",
] as const satisfies readonly (keyof ScreenDetail)[]

export const sameScreen = (a: ScreenDetail | null, b: ScreenDetail | null) =>
    a === b || (a !== null && b !== null && KEYS.every(key => a[key] === b[key]))

export const sameScreens = (
    a: readonly ScreenDetail[],
    b: readonly ScreenDetail[],
) => a.length === b.length && a.every((screen, index) => sameScreen(screen, b[index]!))
