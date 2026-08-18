import { globalAtom } from "valdres"
import type { MeasurementStatus } from "../types/MeasurementStatus"

export const measurementStatusAtom = globalAtom<MeasurementStatus>("idle", {
    name: "@valdres/bandwidth/measurementStatus",
})
