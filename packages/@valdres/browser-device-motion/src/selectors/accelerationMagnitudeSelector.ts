import { selector } from "valdres"
import { motionAtom } from "../atoms/motionAtom"

// Magnitude of the linear acceleration vector (gravity-excluded). Useful for
// shake detection — pair it with a threshold + debounce in user code.
export const accelerationMagnitudeSelector = selector(
    get => {
        const a = get(motionAtom)?.acceleration
        if (!a) return null
        const x = a.x ?? 0
        const y = a.y ?? 0
        const z = a.z ?? 0
        return Math.sqrt(x * x + y * y + z * z)
    },
    { name: "@valdres/browser-device-motion/accelerationMagnitude" },
)
