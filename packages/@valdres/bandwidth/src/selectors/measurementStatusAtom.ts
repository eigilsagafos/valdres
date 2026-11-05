import { selector, type Selector } from "valdres"
import { bandwidthAtom } from "../atoms/bandwidthAtom"
import type { MeasurementStatus } from "../types/MeasurementStatus"

/** The measurement's status; see `MeasurementStatus`. */
export const measurementStatusAtom: Selector<MeasurementStatus> = selector(
    get => get(bandwidthAtom).status,
    {
        name: "@valdres/bandwidth/measurementStatus",
    },
)
