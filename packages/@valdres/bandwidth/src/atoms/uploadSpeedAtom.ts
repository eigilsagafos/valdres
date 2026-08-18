import { globalAtom } from "valdres"
import { ensureMeasurement } from "../lib/ensureMeasurement"
import { setupInvalidation } from "../lib/setupInvalidation"

export const uploadSpeedAtom = globalAtom<number>(
    () => ensureMeasurement().then(r => r.uploadMbps),
    {
        name: "@valdres/bandwidth/uploadSpeed",
        onMount: () => setupInvalidation(),
    },
)
