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
    orientationType: OrientationType
    orientationAngle: number
    isPrimary: boolean
    isInternal: boolean
}
