import { atom } from "valdres"
import type { MeasurementStatus } from "../types/MeasurementStatus"

export const measurementStatusAtom = atom<MeasurementStatus>("idle", {
    global: true,
    name: "@valdres/bandwidth/measurementStatus",
})
