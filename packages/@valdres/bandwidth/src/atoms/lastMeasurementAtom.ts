import { atom } from "valdres"

export const lastMeasurementAtom = atom<number | null>(null, {
    global: true,
    name: "@valdres/bandwidth/lastMeasurement",
})
