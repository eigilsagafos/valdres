import { selector, type Selector } from "valdres"
import { bandwidthAtom } from "../atoms/bandwidthAtom"

/** Upload throughput of the last completed measurement, in Mbps; `null` before one completes. */
export const uploadSpeedAtom: Selector<number | null> = selector(
    get => get(bandwidthAtom).result?.uploadMbps ?? null,
    {
        name: "@valdres/bandwidth/uploadSpeed",
    },
)
