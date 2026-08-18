import { globalAtom } from "valdres"

export const lastMeasurementAtom = globalAtom<number | null>(null, {
    name: "@valdres/bandwidth/lastMeasurement",
})
