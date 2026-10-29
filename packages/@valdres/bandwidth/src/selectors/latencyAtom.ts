import { selector, type Selector } from "valdres"
import { bandwidthAtom } from "../atoms/bandwidthAtom"

/** Median round-trip time of the last completed measurement, in ms; `null` before one completes. */
export const latencyAtom: Selector<number | null> = selector(
    get => get(bandwidthAtom).result?.latencyMs ?? null,
    {
        name: "@valdres/bandwidth/latency",
    },
)
