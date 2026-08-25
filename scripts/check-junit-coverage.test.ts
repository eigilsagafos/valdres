import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"
import { collectCoverage } from "./check-junit-coverage"

// This gate used to live inside the `Test Report` github-script action, where
// no local command could run it: `bun run test:ci` can exit 0 while a package
// emits no JUnit report, and CI would go red on a checkout `bun run verify`
// called green. These tests pin the expectation set the gate is built on.

const rootDir = join(import.meta.dir, "..")
const read = (path: string) => readFileSync(join(rootDir, path), "utf8")

describe("JUnit coverage expectations", () => {
    test("every package with a real test script is expected to report", async () => {
        const { expected } = await collectCoverage("origin/main")

        // Guard the guard: an empty or tiny expectation set would make the
        // gate pass vacuously, which is the failure mode it exists to prevent.
        expect(expected.length).toBeGreaterThan(10)
        expect(expected).toContain("valdres")
    })

    test("the expectation set matches the manifests, independently computed", async () => {
        const { expected } = await collectCoverage("origin/main")

        const manifests: string[] = []
        for await (const file of new Bun.Glob("packages/**/package.json").scan({
            cwd: rootDir,
        }))
            if (!file.split("/").includes("node_modules")) manifests.push(file)

        const fromManifests = manifests
            .filter(manifest => {
                const testScript = JSON.parse(read(manifest)).scripts?.test
                return (
                    typeof testScript === "string" &&
                    !/^echo\s+(['"])no tests\1$/.test(testScript)
                )
            })
            .map(manifest =>
                manifest
                    .replace(/^packages\//, "")
                    .replace(/\/package\.json$/, ""),
            )
            .sort()

        // The live set may legitimately be a superset: packages that had a test
        // script on origin/main but not here are still expected to report.
        expect(expected).toEqual(expect.arrayContaining(fromManifests))
    })

    test("the `no tests` placeholder opts a package out", async () => {
        const { expected } = await collectCoverage("origin/main")
        const optedOut: string[] = []
        for await (const file of new Bun.Glob("packages/**/package.json").scan({
            cwd: rootDir,
        })) {
            if (file.split("/").includes("node_modules")) continue
            const testScript = JSON.parse(read(file)).scripts?.test
            if (/^echo\s+(['"])no tests\1$/.test(testScript ?? ""))
                optedOut.push(
                    file
                        .replace(/^packages\//, "")
                        .replace(/\/package\.json$/, ""),
                )
        }
        // Only meaningful if the repo actually uses the placeholder somewhere;
        // when it does, none of those may appear in the expectation set.
        for (const pkg of optedOut) expect(expected).not.toContain(pkg)
    })

    test("an unresolvable base ref degrades instead of throwing", async () => {
        const coverage = await collectCoverage(
            "refs/heads/definitely-not-a-ref",
        )
        expect(coverage.baseResolved).toBe(false)
        expect(coverage.expected.length).toBeGreaterThan(10)
    })

    test("stale reports are cleared before the suite runs", async () => {
        // Without this the gate is satisfiable by a report from an earlier run:
        // `junit*.xml` is gitignored and never cleaned, so a package that has
        // stopped emitting one passes locally and fails on CI's clean checkout.
        // The cleanup lives in the workflow so CI and verify share it.
        const { buildPlan } = await import("./verify")
        const plan = buildPlan(read(".github/workflows/ci.yaml"))
        const at = (match: (run: string) => boolean) =>
            plan.steps.findIndex(step => match(step.run))

        const clean = at(
            run => run.includes("junit*.xml") && run.includes("-delete"),
        )
        const suite = at(run => run === "bun run test:ci")
        const gate = at(run => run.includes("check-junit-coverage"))

        expect(clean).toBeGreaterThanOrEqual(0)
        expect(clean).toBeLessThan(suite)
        expect(suite).toBeLessThan(gate)
    })

    test("CI enforces the gate as a shell step, not only in the reporter", () => {
        // The whole point of extracting it: if this step is dropped from the
        // workflow, verify silently stops covering it again.
        const workflow = read(".github/workflows/ci.yaml")
        expect(workflow).toContain(
            "run: bun run scripts/check-junit-coverage.ts",
        )
        // And the reporter must consume the same module rather than
        // reimplementing the expectation logic.
        expect(workflow).toContain(
            "'run', 'scripts/check-junit-coverage.ts', '--json'",
        )
    })
})
