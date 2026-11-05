import type { BandwidthEndpoints } from "../types/BandwidthEndpoints"

/** Cloudflare's public speed-test endpoints; contacted only by a measurement. */
export const DEFAULT_ENDPOINTS: BandwidthEndpoints = Object.freeze({
    download: "https://speed.cloudflare.com/__down",
    upload: "https://speed.cloudflare.com/__up",
})

/** `<download>?bytes=N`, or `&bytes=N` after an existing query. */
export const downloadUrl = (download: string, bytes: number): string =>
    `${download}${download.includes("?") ? "&" : "?"}bytes=${bytes}`

export const REQUEST_INIT = {
    cache: "no-store",
    credentials: "omit",
    referrerPolicy: "no-referrer",
} as const satisfies RequestInit
