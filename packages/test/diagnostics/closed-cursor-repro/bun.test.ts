import { afterAll, test } from "bun:test"
import { LeakDetector, retentionPhase } from "../../src/LeakDetector"
import { flushRetentionCapture } from "../../src/retentionCapture"
import { runCase } from "./case.mjs"
const createStore = process.env.REPRO_STAGE === "valdres"
    ? (await import("./valdres.mjs")).store : undefined
afterAll(flushRetentionCapture)
test(`reduction ${process.env.REPRO_STAGE} retain=${process.env.REPRO_RETAIN}`, async () => {
    await runCase(LeakDetector, retentionPhase, createStore)
}, 5000)
