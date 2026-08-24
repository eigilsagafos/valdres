import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { existsSync, readFileSync } from "fs"
import { mkdtemp, rm } from "fs/promises"
import { tmpdir } from "os"
import { join } from "path"
import { buildPlan, resolveStart, runSteps } from "./verify"

// `bun run verify` reproduces ci.yaml's pull-request jobs by reading them out
// of the workflow. These tests are the other half of that contract: they run
// inside the job (`bun test scripts/`), so a workflow change verify cannot
// faithfully reproduce fails in CI, not silently at someone's desk.
//
// The failure this whole mechanism exists for is PR #329: a new test file was
// auto-collected by the Node/V8 rewrite-guard lane, which never ran locally
// because `bun run test` is only one of the job's steps.

const rootDir = join(import.meta.dir, "..")
const read = (path: string) => readFileSync(join(rootDir, path), "utf8")

const workflowSource = read(".github/workflows/ci.yaml")

/** The jobs verify claims to cover. Kept here as a literal so that widening
 *  verify's scope is a deliberate edit in both files. */
const COVERED_JOBS = ["test", "valdres-package"]

/** The `run:` steps of a job, in file order — read with an independent scanner
 *  so the coverage assertions below are a real cross-check and not the plan
 *  agreeing with itself. */
const runStepNames = (jobName: string) => {
    const job =
        workflowSource.match(
            new RegExp(`^    ${jobName}:\\n([\\s\\S]*?)(?=^    \\w)`, "m"),
        )?.[1] ?? ""
    const names: string[] = []
    let pending: string | undefined
    for (const line of job.split("\n")) {
        const name = line.match(/^            - name: (.+)$/)
        if (name) {
            pending = name[1]!.trim()
            continue
        }
        if (/^            - /.test(line)) pending = undefined
        if (/^              run:/.test(line) && pending) {
            names.push(pending)
            pending = undefined
        }
    }
    return names
}

const allRunStepNames = () => COVERED_JOBS.flatMap(runStepNames)

/** Planned steps carry a ` [job]` suffix for display; compare on the CI name. */
const bareName = (name: string) => name.replace(/ \[[^\]]+\]$/, "")

/** Step names repeat across jobs (both install), so identity for ordering is
 *  job + name, not name. */
const qualified = (job: string, name: string) => `${job}::${name}`
const allRunStepKeys = () =>
    COVERED_JOBS.flatMap(job =>
        runStepNames(job).map(name => qualified(job, name)),
    )
const plannedKeys = (steps: Array<{ name: string }>) =>
    steps.map(step =>
        qualified(
            step.name.match(/\[([^\]]+)\]$/)?.[1] ?? COVERED_JOBS[0]!,
            bareName(step.name),
        ),
    )

describe("bun run verify", () => {
    test("the CI jobs still parse into a runnable plan", () => {
        // The compounding assertion. Adding a step with a `${{ }}` expression,
        // an unrecognised `if:`, an unshimmed runner variable, an unhonoured
        // step key, or a job-level `env:` throws here with instructions —
        // instead of verify quietly running a subset, or a different command.
        expect(() => buildPlan(workflowSource)).not.toThrow()
    })

    test("every run: step is either planned or skipped with a reason", () => {
        const plan = buildPlan(workflowSource)
        const accounted = new Set([
            ...plan.steps.map(step => bareName(step.name)),
            ...plan.skipped.map(skip => bareName(skip.name)),
        ])
        const unaccounted = allRunStepNames().filter(
            name => !accounted.has(name),
        )
        expect(unaccounted).toEqual([])
        for (const skip of plan.skipped) expect(skip.reason).not.toBe("")
    })

    test("planned steps keep CI's job and step order", () => {
        const plan = buildPlan(workflowSource)
        const planned = plannedKeys(plan.steps)
        const expected = allRunStepKeys().filter(key => planned.includes(key))
        expect(planned).toEqual(expected)
    })

    test("both pull-request gated jobs are covered", () => {
        // The `test` job alone was the earlier gap: `valdres-package` (publint,
        // ATTW, size budget) is a separate required check on PRs.
        const plan = buildPlan(workflowSource)
        for (const job of COVERED_JOBS)
            expect(
                plan.steps.some(step => step.name.endsWith(`[${job}]`)),
            ).toBe(true)
    })

    test("the publish dry-run is skipped, never planned", () => {
        // It executes scripts/ci-publish.sh against the working tree. If the
        // step is renamed, buildPlan throws on the stale SKIPPED_STEPS key
        // rather than letting the release script run locally.
        const plan = buildPlan(workflowSource)
        expect(plan.steps.map(step => step.name)).not.toContain(
            "Verify publish (dry-run)",
        )
        expect(plan.skipped.map(skip => skip.name)).toContain(
            "Verify publish (dry-run)",
        )
    })

    test("the plan covers the gates `bun run test` does not", () => {
        // Naming them explicitly: deleting one from CI should be a deliberate
        // edit here too, and this is the list the CLAUDE.md note promises.
        const planned = buildPlan(workflowSource)
            .steps.map(step => step.run)
            .join("\n")
        for (const command of [
            "bun run build",
            "bun run build:types",
            "bun run typecheck",
            "typecheck:types",
            "@ts-ignore",
            "test:architecture",
            "test:rewrite-guards:node",
            "test:memory:bun",
            "test:memory:node",
            "lint:publish",
            "bun test scripts/",
            "bun run test:ci",
        ])
            expect(planned).toContain(command)
    })

    test("the root verify script points at this module", () => {
        const { scripts } = JSON.parse(read("package.json"))
        expect(scripts.verify).toBe("bun run scripts/verify.ts")
    })
})

// A workflow verify cannot faithfully reproduce must stop it, not shrink it.
// The whole value of the script is "if it passed, CI's test job passes", so
// every construct below is a hard error before the first step runs.
describe("verify refuses to run a job it cannot reproduce", () => {
    /** A minimal `test` job. Both publish steps are always present because
     *  SKIPPED_STEPS must match something — that check has its own test. */
    const fixture = (...steps: string[]) =>
        [
            "name: CI",
            "jobs:",
            "    test:",
            "        steps:",
            "            - name: Verify publish (dry-run)",
            "              run: DRY_RUN=1 bash scripts/ci-publish.sh",
            "            - name: Verify publish cleanup",
            "              run: git diff --exit-code",
            ...steps,
            "    valdres-package:",
            "        steps:",
            "            - name: Package gate",
            "              run: bun run scripts/check-valdres-package.ts",
        ].join("\n")

    const step = (name: string, body: string[]) =>
        [
            `            - name: ${name}`,
            ...body.map(line => `              ${line}`),
        ].join("\n")

    test("the baseline fixture is otherwise valid", () => {
        const plan = buildPlan(fixture(step("Gate", ["run: echo ok"])))
        expect(plan.steps.map(s => bareName(s.name))).toEqual([
            "Gate",
            "Package gate",
        ])
    })

    test("an unrecognised if: is an error, not a silent skip", () => {
        expect(() =>
            buildPlan(
                fixture(
                    step("Gate", [
                        "if: github.ref == 'refs/heads/main'",
                        "run: echo ok",
                    ]),
                ),
            ),
        ).toThrow(/cannot evaluate/)
    })

    test("a ${{ }} expression is an error", () => {
        expect(() =>
            buildPlan(fixture(step("Gate", ["run: echo ${{ github.sha }}"]))),
        ).toThrow(/GitHub expression/)
    })

    test("an unshimmed runner variable is an error", () => {
        // Handing a gate an empty string is how it becomes a no-op that still
        // reports green.
        expect(() =>
            buildPlan(fixture(step("Gate", ['run: echo "$GITHUB_WORKSPACE"']))),
        ).toThrow(/runner variable/)
        expect(() =>
            buildPlan(fixture(step("Gate", ['run: echo "$RUNNER_TEMP"']))),
        ).not.toThrow()
    })

    test("a step-level env: with an expression is an error", () => {
        expect(() =>
            buildPlan(
                fixture(
                    step("Gate", [
                        "env:",
                        "    REF: ${{ github.ref }}",
                        "run: echo ok",
                    ]),
                ),
            ),
        ).toThrow(/GitHub expression/)
    })

    test("job-level env: is an error, since verify does not apply it", () => {
        const source = fixture(step("Gate", ["run: echo ok"])).replace(
            "        steps:",
            "        env:\n            FOO: bar\n        steps:",
        )
        expect(() => buildPlan(source)).toThrow(/env:/)
    })

    test("renaming a skipped step is an error, not a silent un-skip", () => {
        // Otherwise the release script quietly starts running locally.
        const renamed = fixture(step("Gate", ["run: echo ok"])).replace(
            "Verify publish (dry-run)",
            "Verify publish (dry run)",
        )
        expect(() => buildPlan(renamed)).toThrow(/no longer exist/)
    })

    test("renaming the job is an error", () => {
        const renamed = fixture(step("Gate", ["run: echo ok"])).replace(
            "    test:",
            "    checks:",
        )
        expect(() => buildPlan(renamed)).toThrow(/jobs\.test\.steps/)
    })

    test("dropping the second gated job is an error", () => {
        const dropped = fixture(step("Gate", ["run: echo ok"])).replace(
            "    valdres-package:",
            "    unrelated:",
        )
        expect(() => buildPlan(dropped)).toThrow(/jobs\.valdres-package\.steps/)
    })

    // Checking step VALUES but not step KEYS was the original hole: a key
    // verify does not honour means running a different command than CI and
    // reporting it green. `shell: python` executed by bash is the worst case.
    test.each([
        ["shell", ["shell: python", "run: print(1)"]],
        ["working-directory", ["working-directory: docs", "run: pwd"]],
        ["timeout-minutes", ["timeout-minutes: 5", "run: echo ok"]],
    ])("an unhonoured step key (%s) is an error", (key, body) => {
        expect(() => buildPlan(fixture(step("Gate", body)))).toThrow(
            new RegExp(`does not honour: ${key}`),
        )
    })

    test("continue-on-error needs a step that re-fails on its outcome", () => {
        // Verify has no continue-on-error, so it stops where CI would carry on.
        // That matches CI only when a later step re-fails the job — the way
        // `Test` + `Fail if tests failed` are wired. Demand the pair.
        expect(() =>
            buildPlan(
                fixture(
                    step("Gate", [
                        "id: gate",
                        "continue-on-error: true",
                        "run: exit 1",
                    ]),
                ),
            ),
        ).toThrow(/continue-on-error/)

        expect(() =>
            buildPlan(
                fixture(
                    step("Gate", [
                        "id: gate",
                        "continue-on-error: true",
                        "run: exit 1",
                    ]),
                    step("Fail if gate failed", [
                        "if: steps.gate.outcome == 'failure'",
                        "run: exit 1",
                    ]),
                ),
            ),
        ).not.toThrow()
    })

    test("a command already run in an earlier job is not run twice", () => {
        // Separate CI jobs get separate runners and each installs; locally
        // there is one checkout, so the repeat is dead time.
        const plan = buildPlan(
            fixture(
                step("Install", ["run: bun install --frozen-lockfile"]),
            ).replace(
                "            - name: Package gate",
                "            - name: Install\n              run: bun install --frozen-lockfile\n            - name: Package gate",
            ),
        )
        expect(
            plan.steps.filter(s => s.run === "bun install --frozen-lockfile"),
        ).toHaveLength(1)
        expect(plan.skipped.map(s => s.reason)).toContain(
            "identical command already run in the `test` job",
        )
    })
})

// The execution half. Everything above tests the PLAN; none of it would notice
// if steps ran in the wrong order, ignored their exit code, lost their env, or
// numbered a --from run as if it were complete. These drive real `bash`
// subprocesses against synthetic plans, because the bash semantics are the
// thing under test.
describe("runSteps", () => {
    let temp: string
    const log: string[] = []

    beforeEach(async () => {
        temp = await mkdtemp(join(tmpdir(), "valdres-verify-test-"))
        log.length = 0
    })
    afterEach(async () => {
        await rm(temp, { recursive: true, force: true })
    })

    const plan = (...runs: string[]) =>
        runs.map((run, i) => ({ name: `step ${i + 1}`, run, env: {} }))

    const run = (steps: ReturnType<typeof plan>, start?: number) =>
        runSteps(steps, {
            runnerTemp: temp,
            start,
            cwd: temp,
            stdio: "ignore",
            log: line => log.push(line),
        })

    test("runs every step in order", async () => {
        const outcome = await run(
            plan(
                `echo a >> "$RUNNER_TEMP/order"`,
                `echo b >> "$RUNNER_TEMP/order"`,
            ),
        )
        expect(outcome.failed).toBeUndefined()
        expect(outcome.results.map(r => r.code)).toEqual([0, 0])
        expect(readFileSync(join(temp, "order"), "utf8")).toBe("a\nb\n")
    })

    test("stops at the first failure and does not run later steps", async () => {
        const outcome = await run(
            plan("exit 3", `touch "$RUNNER_TEMP/should-not-exist"`),
        )
        expect(outcome.failed?.code).toBe(3)
        expect(outcome.failed?.index).toBe(0)
        expect(outcome.results).toHaveLength(1)
        expect(existsSync(join(temp, "should-not-exist"))).toBe(false)
    })

    test("RUNNER_TEMP points at the runner directory", async () => {
        await run(plan(`printenv RUNNER_TEMP > "$RUNNER_TEMP/seen"`))
        expect(readFileSync(join(temp, "seen"), "utf8").trim()).toBe(temp)
    })

    test("step env is merged over the ambient environment", async () => {
        const steps = [
            {
                name: "env step",
                run: `printenv STEP_ONLY > "$RUNNER_TEMP/env"`,
                env: { STEP_ONLY: "from-step" },
            },
        ]
        await run(steps)
        expect(readFileSync(join(temp, "env"), "utf8").trim()).toBe("from-step")
    })

    test("the ambient environment is inherited", async () => {
        // CI steps rely on PATH; a from-scratch env would break every one.
        await run(plan(`printenv PATH > "$RUNNER_TEMP/path"`))
        expect(readFileSync(join(temp, "path"), "utf8").trim()).toBe(
            process.env.PATH,
        )
    })

    test("a multi-line step aborts on the first failing command (bash -e)", async () => {
        // GitHub's default shell is `bash -e {0}`. Without -e the step would
        // report the LAST command's status and a failing gate could pass.
        const outcome = await run(
            plan(
                ["false", 'touch "$RUNNER_TEMP/after-false"', "true"].join(
                    "\n",
                ),
            ),
        )
        expect(outcome.failed?.code).toBe(1)
        expect(existsSync(join(temp, "after-false"))).toBe(false)
    })

    test("--from numbering counts against the whole plan, not the slice", async () => {
        // The bug this guards: labelling a resumed run 1/2 instead of 4/5 makes
        // a partial run read like a complete one.
        const outcome = await run(
            plan("true", "true", "true", "true", "true"),
            3,
        )
        expect(outcome.results.map(r => r.index)).toEqual([3, 4])
        expect(log.filter(line => line.startsWith("▸"))).toEqual([
            "▸ 4/5  step 4",
            "▸ 5/5  step 5",
        ])
    })

    test("start beyond the last step runs nothing", async () => {
        const outcome = await run(plan("exit 1"), 1)
        expect(outcome.results).toEqual([])
        expect(outcome.failed).toBeUndefined()
    })
})

describe("resolveStart", () => {
    const steps = [
        { name: "Install [test]", run: "", env: {} },
        { name: "Rewrite guards (Node/V8) [test]", run: "", env: {} },
        { name: "Test [test]", run: "", env: {} },
    ]

    test("no --from starts at the beginning", () => {
        expect(resolveStart(steps, undefined)).toBe(0)
    })

    test("a 1-based index resolves to a 0-based offset", () => {
        expect(resolveStart(steps, "2")).toBe(1)
        expect(resolveStart(steps, "1")).toBe(0)
        expect(resolveStart(steps, "3")).toBe(2)
    })

    test("out-of-range and zero fall through to name matching, then null", () => {
        // Not clamped: silently starting somewhere the user did not ask for is
        // worse than telling them the step does not exist.
        expect(resolveStart(steps, "0")).toBeNull()
        expect(resolveStart(steps, "4")).toBeNull()
        expect(resolveStart(steps, "-1")).toBeNull()
    })

    test("a case-insensitive name substring resolves", () => {
        expect(resolveStart(steps, "rewrite")).toBe(1)
        expect(resolveStart(steps, "NODE/V8")).toBe(1)
    })

    test("an unmatched name is null, not a silent start-from-zero", () => {
        expect(resolveStart(steps, "nope")).toBeNull()
    })
})
