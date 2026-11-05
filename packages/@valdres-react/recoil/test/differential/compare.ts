import { isDeepStrictEqual } from "node:util"
import type { Observations } from "./runner"
import type { Scenario } from "./scenarios"

const UNSUPPORTED = "VALDRES_RECOIL_UNSUPPORTED"

/** Collects every `{ code, feature }` error record inside an observation. */
const refusals = (value: unknown, found: string[] = []): string[] => {
    if (value === null || typeof value !== "object") return found
    const record = value as Record<string, unknown>
    if (record.code === UNSUPPORTED && typeof record.feature === "string")
        found.push(record.feature)
    for (const nested of Object.values(record)) refusals(nested, found)
    return found
}

/**
 * Checks adapter observations against the recorded Recoil oracle under each
 * scenario's declared expectation. Returns one message per failure.
 */
export const compareWithOracle = (
    scenarios: readonly Scenario[],
    oracle: Observations,
    adapter: Observations,
): string[] => {
    const failures: string[] = []
    const show = (value: unknown) => JSON.stringify(value)
    for (const scenario of scenarios) {
        const { name, adapter: expectation } = scenario
        if (!(name in oracle)) {
            failures.push(`${name}: missing from the Recoil oracle; run the oracle`)
            continue
        }
        // The oracle is JSON: compare what JSON keeps (undefined members drop).
        const actual =
            adapter[name] === undefined
                ? undefined
                : JSON.parse(JSON.stringify(adapter[name]))
        if (expectation.kind === "match") {
            if (!isDeepStrictEqual(actual, oracle[name]))
                failures.push(`${name}: expected Recoil's ${show(oracle[name])}, got ${show(actual)}`)
        } else if (expectation.kind === "refused") {
            if (!refusals(actual).includes(expectation.feature))
                failures.push(`${name}: expected refusal of "${expectation.feature}", got ${show(actual)}`)
        } else if (!isDeepStrictEqual(actual, expectation.adapter)) {
            failures.push(`${name}: expected documented divergence ${show(expectation.adapter)}, got ${show(actual)}`)
        } else if (isDeepStrictEqual(actual, oracle[name])) {
            failures.push(`${name}: declared as a divergence but now matches Recoil; make it "match"`)
        }
    }
    for (const name of Object.keys(oracle))
        if (!scenarios.some(scenario => scenario.name === name))
            failures.push(`${name}: in the oracle but not a scenario; run the oracle`)
    return failures
}
