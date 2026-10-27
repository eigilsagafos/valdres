import type { ExternalSource } from "valdres"
import type { BandwidthState } from "../types/BandwidthState"
import { readBandwidth, retainBandwidth } from "./measurementRecord"
import { IDLE_STATE } from "./states"

/**
 * Reading samples the shared record; subscribing only registers for its
 * publications. Neither ever measures. A server render reads the fixed idle
 * seed, so hydration matches whatever the server rendered.
 */
export const bandwidthSource: ExternalSource<BandwidthState> = {
    getSnapshot: readBandwidth,
    getServerSnapshot: () => IDLE_STATE,
    subscribe: retainBandwidth,
}
