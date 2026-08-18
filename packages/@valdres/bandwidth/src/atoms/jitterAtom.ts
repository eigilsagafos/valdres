import { globalAtom } from "valdres"
import { ensureMeasurement } from "../lib/ensureMeasurement"
import { setupInvalidation } from "../lib/setupInvalidation"

export const jitterAtom = globalAtom<number>(
    () => ensureMeasurement().then(r => r.jitterMs),
    {
        name: "@valdres/bandwidth/jitter",
        onMount: () => setupInvalidation(),
    },
)
