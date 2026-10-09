export interface ScreenDetail {
    label: string
    left: number
    top: number
    width: number
    height: number
    availLeft: number
    availTop: number
    availWidth: number
    availHeight: number
    colorDepth: number
    pixelDepth: number
    devicePixelRatio: number
    /** The DOM `OrientationType` values, declared here for DOM-less consumers. */
    orientationType:
        | "portrait-primary"
        | "portrait-secondary"
        | "landscape-primary"
        | "landscape-secondary"
    orientationAngle: number
    isPrimary: boolean
    isInternal: boolean
}
