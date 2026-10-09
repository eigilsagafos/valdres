export interface MotionConstructor {
    readonly requestPermission?: () => Promise<PermissionState>
}

export type MotionHost =
    | { readonly kind: "unsupported" }
    | { readonly kind: "insecure" }
    | {
          readonly kind: "supported"
          readonly view: Window
          readonly ctor: MotionConstructor
      }

const UNSUPPORTED: MotionHost = Object.freeze({ kind: "unsupported" })
const INSECURE: MotionHost = Object.freeze({ kind: "insecure" })

/**
 * Resolved on every call, never at import, so importing reads no browser
 * global and a host that appears later is picked up. The secure-context check
 * comes first: browsers hide `DeviceMotionEvent` from insecure contexts, which
 * would otherwise read as merely unsupported.
 */
export const resolveMotionHost = (): MotionHost => {
    if (typeof window === "undefined") return UNSUPPORTED
    if (typeof window.addEventListener !== "function") return UNSUPPORTED
    if (window.isSecureContext === false) return INSECURE
    const ctor = (window as { DeviceMotionEvent?: unknown }).DeviceMotionEvent
    if (typeof ctor !== "function") return UNSUPPORTED
    return { kind: "supported", view: window, ctor: ctor as MotionConstructor }
}
