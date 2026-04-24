import { atom } from "valdres"
import { ensureMeasurement } from "../lib/ensureMeasurement"
import { setupInvalidation } from "../lib/setupInvalidation"

export const jitterAtom = atom<number>(
    () => ensureMeasurement().then(r => r.jitterMs),
    {
        global: true,
        name: "@valdres/bandwidth/jitter",
        onMount: () => setupInvalidation(),
    },
)
