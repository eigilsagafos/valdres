import type { ScreenDetailsLike } from "./screenDetailsRecord"

export type ScreenDetailsHost =
    | { readonly kind: "unsupported" }
    | { readonly kind: "insecure" }
    | {
          readonly kind: "supported"
          readonly view: Window
          readonly getScreenDetails: () => Promise<ScreenDetailsLike>
      }

const UNSUPPORTED: ScreenDetailsHost = Object.freeze({ kind: "unsupported" })
const INSECURE: ScreenDetailsHost = Object.freeze({ kind: "insecure" })

/**
 * Resolved on every call, never at import. The secure-context check comes
 * first: browsers hide `getScreenDetails` from insecure contexts, which would
 * otherwise read as merely unsupported.
 */
export const resolveScreenDetailsHost = (): ScreenDetailsHost => {
    if (typeof window === "undefined") return UNSUPPORTED
    if (window.isSecureContext === false) return INSECURE
    const getScreenDetails = (window as { getScreenDetails?: unknown })
        .getScreenDetails
    if (typeof getScreenDetails !== "function") return UNSUPPORTED
    return {
        kind: "supported",
        view: window,
        getScreenDetails: getScreenDetails as () => Promise<ScreenDetailsLike>,
    }
}
