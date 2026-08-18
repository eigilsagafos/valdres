import { globalAtom } from "valdres"
import { ensureMeasurement } from "../lib/ensureMeasurement"
import { setupInvalidation } from "../lib/setupInvalidation"

export const downloadSpeedAtom = globalAtom<number>(
    () => ensureMeasurement().then(r => r.downloadMbps),
    {
        name: "@valdres/bandwidth/downloadSpeed",
        onMount: () => setupInvalidation(),
    },
)
