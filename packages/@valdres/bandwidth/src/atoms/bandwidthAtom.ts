import { externalAtom, type ExternalAtom } from "valdres"
import { bandwidthSource } from "../lib/bandwidthSource"
import type { BandwidthState } from "../types/BandwidthState"

/**
 * The coherent measurement state: status, running phase, provisional
 * readings, last result and error from one publication, shared by every Store
 * in this page or process. Reading or subscribing never measures; only
 * `measureBandwidth()` does.
 */
export const bandwidthAtom: ExternalAtom<BandwidthState> = externalAtom(
    bandwidthSource,
    {
        name: "@valdres/bandwidth/state",
    },
)
