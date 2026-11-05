import { selector, type Selector } from "valdres"
import { bandwidthAtom } from "../atoms/bandwidthAtom"

/** `Date.now()` when the last completed measurement finished; `null` before one completes. */
export const lastMeasurementAtom: Selector<number | null> = selector(
    get => get(bandwidthAtom).result?.timestamp ?? null,
    {
        name: "@valdres/bandwidth/lastMeasurement",
    },
)
