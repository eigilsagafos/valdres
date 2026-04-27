import { atom } from "valdres"
import { ensureMeasurement } from "../lib/ensureMeasurement"
import { setupInvalidation } from "../lib/setupInvalidation"

export const latencyAtom = atom<number>(
    () => ensureMeasurement().then(r => r.latencyMs),
    {
        global: true,
        name: "@valdres/bandwidth/latency",
        onMount: () => setupInvalidation(),
    },
)
