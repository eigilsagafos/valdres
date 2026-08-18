import { globalAtom } from "valdres"
import { ensureMeasurement } from "../lib/ensureMeasurement"
import { setupInvalidation } from "../lib/setupInvalidation"

export const latencyAtom = globalAtom<number>(
    () => ensureMeasurement().then(r => r.latencyMs),
    {
        name: "@valdres/bandwidth/latency",
        onMount: () => setupInvalidation(),
    },
)
