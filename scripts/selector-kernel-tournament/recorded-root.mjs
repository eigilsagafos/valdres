import { AsyncLocalStorage } from "node:async_hooks"
import { isAbsolute } from "node:path"
import { ROOT, requireGate } from "./inputs.mjs"
// Recorded invocation paths are evidence, not locations from which to load
// authority. Validators always read/build their own protected frozen bytes.
const recording = new AsyncLocalStorage()
export const recordedRoot = () => recording.getStore() ?? ROOT
export function withRecordedRoot(root, body) {
    requireGate(
        typeof root === "string" && isAbsolute(root) && !/[\r\n\0]/.test(root),
        "PROVENANCE-RECORDED-ROOT",
        "absolute recorded source root required",
    )
    return recording.run(root, body)
}
