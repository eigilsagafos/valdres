import { selector, type Selector } from "valdres"
import { bandwidthAtom } from "../atoms/bandwidthAtom"

/** Download throughput of the last completed measurement, in Mbps; `null` before one completes. */
export const downloadSpeedAtom: Selector<number | null> = selector(
    get => get(bandwidthAtom).result?.downloadMbps ?? null,
    {
        name: "@valdres/bandwidth/downloadSpeed",
    },
)
