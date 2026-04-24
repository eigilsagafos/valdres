import type { BandwidthResult } from "../../types/BandwidthResult"

export const measurementCache: {
    promise: Promise<BandwidthResult> | null
    controller: AbortController | null
} = {
    promise: null,
    controller: null,
}
