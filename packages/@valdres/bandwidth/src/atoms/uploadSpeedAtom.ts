import { atom } from "valdres"
import { ensureMeasurement } from "../lib/ensureMeasurement"
import { setupInvalidation } from "../lib/setupInvalidation"

export const uploadSpeedAtom = atom<number>(
    () => ensureMeasurement().then(r => r.uploadMbps),
    {
        global: true,
        name: "@valdres/bandwidth/uploadSpeed",
        onMount: () => setupInvalidation(),
    },
)
