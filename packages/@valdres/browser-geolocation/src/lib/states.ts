import type { GeolocationState } from "../types/GeolocationState"

const fixed = (status: GeolocationState["status"]): GeolocationState =>
    Object.freeze({ status, position: null, error: null })

export const UNSUPPORTED_STATE = fixed("unsupported")
export const INSECURE_STATE = fixed("insecure")
export const IDLE_STATE = fixed("idle")
export const PENDING_STATE = fixed("pending")
