export interface OrientationConstructor {
    readonly requestPermission?: () => Promise<PermissionState>
}

export type OrientationHost =
    | { readonly kind: "unsupported" }
    | { readonly kind: "insecure" }
    | {
          readonly kind: "supported"
          readonly view: Window
          readonly ctor: OrientationConstructor
      }

const UNSUPPORTED: OrientationHost = Object.freeze({ kind: "unsupported" })
const INSECURE: OrientationHost = Object.freeze({ kind: "insecure" })

/**
 * Resolved on every call, never at import, so importing reads no browser
 * global and a host that appears later is picked up. The secure-context check
 * comes first: browsers hide `DeviceOrientationEvent` from insecure contexts, which
 * would otherwise read as merely unsupported.
 */
export const resolveOrientationHost = (): OrientationHost => {
    if (typeof window === "undefined") return UNSUPPORTED
    if (typeof window.addEventListener !== "function") return UNSUPPORTED
    if (window.isSecureContext === false) return INSECURE
    const ctor = (window as { DeviceOrientationEvent?: unknown }).DeviceOrientationEvent
    if (typeof ctor !== "function") return UNSUPPORTED
    return { kind: "supported", view: window, ctor: ctor as OrientationConstructor }
}
