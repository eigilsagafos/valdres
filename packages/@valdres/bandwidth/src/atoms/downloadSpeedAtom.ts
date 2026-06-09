import { atom } from "valdres"
import { ensureMeasurement } from "../lib/ensureMeasurement"
import { setupInvalidation } from "../lib/setupInvalidation"

export const downloadSpeedAtom = atom<number>(
    () => ensureMeasurement().then(r => r.downloadMbps),
    {
        global: true,
        name: "@valdres/bandwidth/downloadSpeed",
        onMount: () => setupInvalidation(),
    },
)
