export type GeolocationHost =
    | { readonly kind: "unsupported" }
    | { readonly kind: "insecure" }
    | { readonly kind: "supported"; readonly geolocation: Geolocation }

const UNSUPPORTED: GeolocationHost = Object.freeze({ kind: "unsupported" })
const INSECURE: GeolocationHost = Object.freeze({ kind: "insecure" })

/**
 * Resolved on every call, never at import, so importing reads no browser
 * global and a host that appears later is picked up.
 */
export const resolveGeolocationHost = (): GeolocationHost => {
    if (typeof navigator === "undefined") return UNSUPPORTED
    const geolocation = (navigator as { geolocation?: Geolocation }).geolocation
    if (
        geolocation == null ||
        typeof geolocation.watchPosition !== "function" ||
        typeof geolocation.clearWatch !== "function"
    )
        return UNSUPPORTED
    if ((globalThis as { isSecureContext?: unknown }).isSecureContext === false)
        return INSECURE
    return { kind: "supported", geolocation }
}
