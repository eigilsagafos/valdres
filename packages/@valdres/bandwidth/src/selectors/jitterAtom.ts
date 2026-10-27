import { selector, type Selector } from "valdres"
import { bandwidthAtom } from "../atoms/bandwidthAtom"

/** Round-trip time standard deviation of the last completed measurement, in ms; `null` before one completes. */
export const jitterAtom: Selector<number | null> = selector(
    get => get(bandwidthAtom).result?.jitterMs ?? null,
    {
        name: "@valdres/bandwidth/jitter",
    },
)
