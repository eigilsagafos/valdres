import { describe, expect, test } from "bun:test"
import type { LateInstallScenario } from "./fixtures/external-late-install"

const scenarios = [
    [
        "cold-subscription",
        "cold family subscription attaches and releases once",
    ],
    [
        "cold-catchup",
        "cold family subscription notifies once for startup catch-up",
    ],
    [
        "propagation",
        "first installation during propagation notifies only the final value",
    ],
    [
        "equal-propagation",
        "equal-value topology still attaches the new external source",
    ],
    [
        "propagation-setup-failure",
        "late setup failure preserves the committed write and runs every callback",
    ],
    [
        "cold-admission-failure",
        "failed late admission rolls back and revokes its generation",
    ],
    ["pull-memo", "first-install dormant reads sample each identity once"],
    [
        "transaction",
        "transaction-created external state joins the later committed operation",
    ],
    [
        "prior-control-fault",
        "a control fault preceding installation remains exact after all notifications",
    ],
    [
        "prior-control-notification-fault",
        "a pre-install control fault preserves notification error provenance",
    ],
    [
        "multiple-prior-control-faults",
        "every control fault before installation is adopted in occurrence order",
    ],
    [
        "initial-control-failure",
        "first-install initial control failure escapes exactly without admission",
    ],
    [
        "operation-phase-reset",
        "a new owned operation resets the phase left by external invalidation",
    ],
] as const satisfies readonly (readonly [LateInstallScenario, string])[]

describe("fresh public-domain ExternalAtom installation", () => {
    for (const [scenario, description] of scenarios) {
        test(description, () => {
            // A separate process is essential: another test defining even an
            // unrelated ExternalAtom would hide the first-install boundary.
            const child = Bun.spawnSync({
                cmd: [
                    process.execPath,
                    `${import.meta.dir}/fixtures/external-late-install.ts`,
                    scenario,
                ],
                stdout: "pipe",
                stderr: "pipe",
            })
            expect(child.exitCode, child.stderr.toString()).toBe(0)
            expect(child.stdout.toString().trim()).toBe(`PASS ${scenario}`)
        })
    }
})
