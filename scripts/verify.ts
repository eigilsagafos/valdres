/**
 * `bun run verify` — run ci.yaml's pull-request gates locally, driven by CI's
 * own file.
 *
 * `bun run test` is a single step in the `test` job. The others — build, build:types,
 * typecheck, the type-level tests, the `@ts-ignore` ban, the architecture gate,
 * the Node/V8 rewrite-guard lane, both retained-memory gates, the
 * valdres-svelte publish lint, the JUnit coverage gate, the `scripts/` tests —
 * only ever ran on GitHub, so anything they alone catch stayed invisible until
 * the PR went red.
 * PR #329 landed exactly there: a new `src/lib/*Fuzz.test.ts` is
 * auto-collected by `vitest.rewrite-guards.config.ts`, where `bun:test` does
 * not resolve, so the file had to import `test/performance/test-compat` like
 * its three siblings. Nothing local surfaced that.
 *
 * The step list is READ FROM `.github/workflows/ci.yaml` at run time rather
 * than copied here, because a hand-maintained duplicate drifts back into the
 * same gap the first time someone adds a step. Every `run:` block in the
 * covered jobs executes, in the jobs' order, under `bash -e` the way the runner
 * does it.
 *
 * SCOPE: both pull-request jobs in ci.yaml — `test` and `valdres-package` (the
 * published-tarball gate: publint, ATTW, size budgets; ~13s). It does NOT cover
 * `docs-ci.yml` or the Bencher gate; those are listed under NOT_COVERED and
 * printed on every run, because a "pre-PR command" that silently covers some of
 * the gates is the same class of problem verify exists to fix.
 *
 * WHAT THIS IS NOT: a runner. It does not reproduce job isolation — GitHub gives
 * each job a fresh machine and a clean checkout, while verify runs both jobs
 * back to back in your working tree, so `valdres-package` sees whatever the
 * `test` steps left behind. That is fine today (the package gate rebuilds from
 * source) and it is why the duplicated `bun install` between the two jobs is
 * deduped rather than repeated. If you need real job semantics, that is what
 * `act` is for; verify's job is running the repo's gates fast.
 *
 * TWO STEPS ARE DELIBERATELY NOT RUN, both of them the publish dry-run:
 *
 *   - "Verify publish (dry-run)" invokes `scripts/ci-publish.sh`, the real
 *     release script. `DRY_RUN=1` stops it short of publishing, but it still
 *     rewrites every package manifest in place and restores it afterwards.
 *     That is fine on a throwaway runner; it is not something to point at a
 *     working tree with uncommitted edits in it.
 *   - "Verify publish cleanup" exists only to prove the dry-run left no
 *     residue (`git diff --exit-code` over the manifests, no stray
 *     `package.tmp.json`). With the dry-run skipped it verifies nothing, and
 *     it would fail on any legitimate uncommitted manifest change.
 *
 * Everything else those jobs run, this runs. Anything CI grows that this cannot
 * faithfully reproduce — an unrecognised `if:`, a `${{ }}` expression, a runner
 * variable with no local equivalent, a step KEY verify does not honour
 * (`shell:`, `working-directory:`), an uncompensated `continue-on-error:` — is a
 * hard error before the first step rather than a quiet omission, and
 * `scripts/verify.test.ts` builds the plan in CI so the divergence is caught
 * there too. Checking keys and not just values is the difference between
 * "verify passed" meaning something and verify running `shell: python` through
 * bash and calling it green.
 *
 * It also refuses to run at all on a toolchain that does not match CI's pins.
 * That is not fussiness: bundler output is Bun-version-specific and the
 * published-package size gate now runs here, so the wrong Bun measures
 * something other than what CI measures and a green result would be a lie.
 *
 *   bun run verify              # both jobs, start to finish
 *   bun run verify --list       # print the plan, run nothing (no toolchain needed)
 *   bun run verify --from=9     # resume at step 9 (index or name substring)
 *   bun run verify --allow-toolchain-drift   # run on a mismatched bun/node anyway
 */
import { createHash } from "node:crypto"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const WORKFLOW = ".github/workflows/ci.yaml"

/** The pull-request gates in ci.yaml, in the order verify runs them.
 *  `valdres-package` is path-filtered on GitHub (`packages/valdres/**`) but
 *  takes seconds locally, so verify always runs it rather than reasoning about
 *  your diff. */
const JOBS = ["test", "valdres-package"]

/** Jobs verify deliberately does not run, and why. Every job declared in
 *  ci.yaml must appear either here or in JOBS — a new job is otherwise outside
 *  verify's coverage with nothing to say so, which is the drift this command
 *  exists to prevent. */
const SKIPPED_JOBS: Record<string, { when: string; reason: string }> = {
    publish: {
        // Stored, not assumed. The reason below is only true while this exact
        // condition holds; widening or deleting it turns `publish` into a
        // pull-request job that verify would go on silently skipping.
        when: "github.event_name == 'push' && github.ref == 'refs/heads/main'",
        reason: "push-to-main only, never a pull-request gate — and it publishes to npm",
    },
}

/** Digest of an action step's CONFIGURATION — everything but its name (the
 *  policy key) and its `uses:` version (bumping `@v6` to `@v7` should not be
 *  churn; the action slug is checked separately). Stable key order so the
 *  digest tracks meaning, not YAML authoring order.
 *
 *  Only actions that execute caller-supplied code need one — today that is
 *  `actions/github-script`, whose `with.script` can call `core.setFailed` and
 *  therefore gate the job. `checkout` cannot gate; `setup-bun` / `setup-node`
 *  carry only pins, which toolchainDrift validates directly; `paths-filter`
 *  can only make CI run the job LESS often than verify does. */
const configDigest = (step: WorkflowStep) => {
    const config = {
        with: step.with ?? null,
        if: step.if ?? null,
        env: step.env ?? null,
        "continue-on-error": step["continue-on-error"] ?? null,
        id: step.id ?? null,
    }
    return createHash("sha256")
        .update(JSON.stringify(config))
        .digest("hex")
        .slice(0, 12)
}

/** The digest of ci.yaml's `Test Report` configuration as reviewed: its script
 *  reports results and calls `core.setFailed` only for conditions the
 *  `JUnit coverage gate` shell step also enforces. */
const TEST_REPORT_CONFIG = "2dcc96ee6def"

const CHECKOUT = "you already have a checkout"
const SETUP_BUN =
    "installs the pinned Bun; verify compares your local Bun against that pin in preflight instead"
const SETUP_NODE =
    "installs the pinned Node; compared against your local Node in preflight instead"

/** `uses:` steps in covered jobs, and why each has no local equivalent.
 *
 *  Keyed by JOB AND STEP, not by action. Keying by action alone grants a
 *  standing permission: a second `actions/github-script` step calling
 *  `core.setFailed` would have been waved through on the strength of the first
 *  one's entry — recreating exactly the gate-hidden-behind-`uses:` hole that
 *  started this file. A new action step must be decided on, every time.
 *
 *  Unnamed steps key on their versionless action slug, so bumping `@v6` to
 *  `@v7` is not a spurious failure; the `action` field still pins WHICH action
 *  a named step may be. */
const SKIPPED_ACTIONS: Record<
    string,
    { action: string; reason: string; config?: string }
> = {
    "test / actions/checkout": { action: "actions/checkout", reason: CHECKOUT },
    "test / oven-sh/setup-bun": {
        action: "oven-sh/setup-bun",
        reason: SETUP_BUN,
    },
    "test / actions/setup-node": {
        action: "actions/setup-node",
        reason: SETUP_NODE,
    },
    "test / Test Report": {
        action: "actions/github-script",
        reason: "posts the JUnit summary to the GitHub Checks API. Its one GATE — every test-bearing package must emit a report — is enforced by scripts/check-junit-coverage.ts, which runs as a shell step verify executes",
        // This one carries a digest because github-script runs ARBITRARY
        // caller-supplied JS, and that script can call `core.setFailed`. The
        // reason above is a claim about what the script does; without pinning
        // the script, adding a second gate to it stays silently skipped —
        // which is the hole this whole file started from. Update the digest
        // only after re-reading the script and confirming any new failure path
        // has a local equivalent.
        config: TEST_REPORT_CONFIG,
    },
    "valdres-package / actions/checkout": {
        action: "actions/checkout",
        reason: CHECKOUT,
    },
    "valdres-package / Detect package and publishing changes": {
        action: "dorny/paths-filter",
        reason: "decides whether this path-filtered job runs at all; verify always runs it rather than reasoning about your diff",
    },
    "valdres-package / oven-sh/setup-bun": {
        action: "oven-sh/setup-bun",
        reason: SETUP_BUN,
    },
    "valdres-package / actions/setup-node": {
        action: "actions/setup-node",
        reason: SETUP_NODE,
    },
}

/** Commands verify runs once even though more than one CI job runs them. Every
 *  CI job gets a fresh runner and installs; locally there is one checkout. This
 *  is the ONE place verify does less than CI, so it is an explicit list rather
 *  than a general "seen this command before" rule: a repeated gate must never
 *  be dropped silently, and repeats WITHIN a job are always intentional. */
const IDEMPOTENT_SETUP = new Set(["bun install --frozen-lockfile"])

/** CI surface verify does NOT cover, printed on every run. A pre-PR command
 *  that quietly covers two thirds of the gates is the same class of problem
 *  verify was written to fix. */
const NOT_COVERED = [
    "docs-ci.yml — bun run docs:build && bun run scripts/gen-readmes.ts --check",
    "bencher-pr.yml — benchmark gate (needs a base run to compare against)",
]

const root = join(import.meta.dir, "..")

/** `Bun.YAML` shipped after the pinned `@types/bun` (1.2.2), so it is typed
 *  here instead of adding a YAML dependency for one file. */
const yaml = (Bun as unknown as { YAML: { parse(source: string): unknown } })
    .YAML

type WorkflowStep = {
    name?: string
    id?: string
    run?: string
    uses?: string
    if?: string
    env?: Record<string, string>
    with?: Record<string, string>
    "continue-on-error"?: boolean
}

/** Step keys verify knows how to honour. A `run:` step carrying anything else
 *  is a hard error, because the alternative is running a DIFFERENT command than
 *  CI and reporting it green: `shell: python` executed by bash, or
 *  `working-directory: docs` executed at the repo root. Checking keys, not just
 *  values, is what makes "verify passed" mean something. */
const SUPPORTED_STEP_KEYS = new Set([
    "name",
    "id",
    "run",
    "uses",
    "with",
    "if",
    "env",
    "continue-on-error",
])

/** Job keys that provably do not change whether or how a covered job's steps
 *  execute. The omissions are the point, and they fall into two groups.
 *
 *  Change what CI executes:
 *  - `defaults` (run.shell / run.working-directory), `container`, `services`,
 *    `strategy`.
 *  - `timeout-minutes` — GitHub kills the job at the deadline; `runSteps`
 *    enforces none, so a local pass could hide a CI timeout.
 *
 *  Change WHETHER the job runs at all, which verify models not at all — it
 *  would replay a job GitHub skipped and still call that a faithful replay:
 *  - `if` — a job condition.
 *  - `needs` — a failed or skipped prerequisite skips this job too.
 *  - `environment` — can hold the job for manual approval.
 *  - `concurrency` — can cancel the job mid-run. */
const SUPPORTED_JOB_KEYS = new Set([
    "name",
    "runs-on",
    "steps",
    // Kept deliberately. `permissions` scopes GITHUB_TOKEN for actions, which
    // verify does not run; `outputs` is consumed by other jobs. Neither
    // changes whether or how this job's steps execute.
    "permissions",
    "outputs",
])

/** Same reasoning one level up: workflow-level `defaults` and `env` reach every
 *  step in every job. */
const SUPPORTED_WORKFLOW_KEYS = new Set([
    "name",
    "on",
    "run-name",
    "concurrency",
    "permissions",
    "jobs",
])

export type PlannedStep = {
    name: string
    run: string
    env: Record<string, string>
}

/** Covered job name -> the version that job pins, or undefined if it sets up no
 *  such toolchain at all (which is itself a problem, not a neutral absence). */
export type ToolPins = Record<string, string | undefined>

export type Plan = {
    steps: PlannedStep[]
    skipped: Array<{ name: string; reason: string }>
    /** Per job, so a job losing its setup action is visible. Disagreeing pins
     *  mean no single local toolchain can replay them. */
    pinned: { bun: ToolPins; node: ToolPins }
    /** Every distinct `runs-on` label across the covered jobs. */
    runners: string[]
}

/** The only `run:` steps verify refuses to execute, and why. A name here that
 *  matches no step in the job is a hard error: a rename must not silently turn
 *  the release script back on. */
export const SKIPPED_STEPS: Record<
    string,
    { job: string; run: string; reason: string }
> = {
    "Verify publish (dry-run)": {
        job: "test",
        run: "DRY_RUN=1 bash scripts/ci-publish.sh",
        reason: "runs the real release script (scripts/ci-publish.sh) — DRY_RUN=1 still rewrites every package manifest in place, which is fine on a throwaway runner and not on your working tree",
    },
    "Verify publish cleanup": {
        job: "test",
        run: [
            "git diff --exit-code -- 'packages/**/package.json'",
            "",
            `stray_backups="$(find packages -name package.tmp.json -not -path '*/node_modules/*' -print)"`,
            'if [ -n "$stray_backups" ]; then',
            '    echo "::error::Publish dry-run left package.tmp.json backup files behind"',
            '    echo "$stray_backups"',
            "    exit 1",
            "fi",
            "",
        ].join("\n"),
        reason: "only asserts the dry-run above left no residue, so with that skipped it verifies nothing — and it fails on any legitimate uncommitted package.json edit",
    },
}

/** Runner variables verify can honestly reproduce. A `run:` block reading any
 *  other one is a hard error: handing a gate an empty string is how it turns
 *  into a no-op that still reports green. */
const SUPPORTED_RUNNER_VARIABLES = new Set(["RUNNER_TEMP"])

const RUNNER_VARIABLE = /\$\{?((?:GITHUB|RUNNER)_[A-Z_]+)/g

/** `steps.<id>.outcome == 'failure'` — the exact condition CI uses to turn a
 *  `continue-on-error` step back into a job failure. Shared by evaluateIf (what
 *  verify may skip) and assertCompensated (what makes skipping it correct), so
 *  the two can never disagree about which shape is understood.
 *
 *  `outcome` only, deliberately. GitHub records a failed step's pre-policy
 *  result in `outcome` and its post-`continue-on-error` result in `conclusion`
 *  — which is `success`. So `conclusion == 'failure'` never fires for the step
 *  it is meant to compensate: CI would tolerate the failure and go green while
 *  verify stopped, the one direction of divergence that wastes your time. */
const FAILURE_COMPENSATOR = /^steps\.([\w-]+)\.outcome == 'failure'$/

/** Does this command definitely exit non-zero? Matching the `if:` shape is not
 *  enough to prove a step re-fails the job: a later step gated on the same
 *  outcome that merely reports (`run: echo "tests failed"`) leaves CI green
 *  while verify stops red. Verify cannot decide this in general, so it accepts
 *  only commands that unconditionally fail.
 *
 *  `exit N` is taken modulo 256 by the shell, so `exit 256` and `exit 512` are
 *  SUCCESS — a compensator written that way compensates for nothing. `exit 300`
 *  is a genuine failure (status 44) and is accepted. */
const alwaysFails = (command: string) => {
    const trimmed = command.trim()
    if (trimmed === "false") return true
    const status = trimmed.match(/^exit\s+([0-9]+)$/)?.[1]
    return status !== undefined && Number(status) % 256 !== 0
}

/** GitHub `if:` expressions verify knows how to answer locally. Returning null
 *  means "unrecognised", which stops the run — a new conditional step must get
 *  a deliberate local answer rather than being dropped on the floor. */
const evaluateIf = (
    expression: string,
): { run: true } | { run: false; reason: string } | null => {
    const normalized = expression.trim()
    // verify is the pre-PR command, so answer as a pull request would.
    if (normalized === "github.event_name == 'pull_request'")
        return { run: true }
    // The one outcome-gated shape verify understands: a step that re-fails the
    // job because an earlier `continue-on-error` step failed. Verify does not
    // honour `continue-on-error` (see assertCompensated), so the failing step
    // has already stopped the run and this one has nothing left to do.
    //
    // Deliberately exact. Matching any mention of `.outcome` would swallow a
    // real gate like `if: steps.build.outcome == 'success'`, silently skipping
    // it instead of raising the promised unrecognised-condition error.
    if (FAILURE_COMPENSATOR.test(normalized))
        return {
            run: false,
            reason: "re-fails the job on an earlier step's failure; verify fails on that step itself instead",
        }
    // dorny/paths-filter output — GitHub skips the job when your diff misses
    // the filter. Verify has no diff context and these gates are cheap, so it
    // runs them unconditionally rather than guessing.
    if (
        /^github\.event_name != 'pull_request' \|\|\s*steps\.\w+\.outputs\.\w+ == 'true'$/.test(
            normalized.replace(/\s+/g, " "),
        )
    )
        return { run: true }
    return null
}

const teach = (detail: string) =>
    new Error(
        `${detail}\n\n` +
            `Teach scripts/verify.ts how to handle it, or add the step to SKIPPED_STEPS ` +
            `with a reason. Leaving it out silently is the drift this script exists to prevent.`,
    )

/** `continue-on-error: true` lets a step fail without failing the job. Verify
 *  has no such notion — it stops. That matches CI only when a LATER step
 *  re-fails the job on this one's outcome, which is exactly how the `Test` step
 *  is wired (`Fail if tests failed`). Without that compensating step, CI would
 *  go green where verify goes red, so demand one rather than quietly becoming
 *  stricter than the thing being reproduced.
 *
 *  Only steps AFTER this one count. GitHub evaluates conditions in order, so a
 *  compensator placed earlier reads an empty `steps.<id>.outcome`, never fires,
 *  and leaves CI green on a failure verify treats as fatal. */
const assertCompensated = (
    step: WorkflowStep,
    name: string,
    siblings: WorkflowStep[],
    index: number,
) => {
    const policy = step["continue-on-error"]
    // GitHub also accepts an expression here (`continue-on-error: ${{ … }}`),
    // which parses as a string. Only the runner can evaluate it, and a plain
    // `!== true` check would wave it through as strict — so CI could tolerate a
    // failure verify treats as fatal. Literal booleans only.
    if (policy !== undefined && typeof policy !== "boolean")
        throw teach(
            `Step "${name}" in ${WORKFLOW} has a non-literal \`continue-on-error: ${String(
                policy,
            )}\`. Only the runner can evaluate that, so verify cannot know whether CI tolerates this step failing.`,
        )
    if (policy !== true) return
    const id = step.id
    const compensator =
        id !== undefined &&
        siblings.slice(index + 1).some(other => {
            if ((other.if ?? "").trim().match(FAILURE_COMPENSATOR)?.[1] !== id)
                return false
            // A compensator that is itself tolerated fails nothing, and an
            // action step's effect on the job is opaque to verify. Anything but
            // a literal `false`/absent disqualifies it: `continue-on-error:
            // ${{ true }}` is a string, so an `=== true` test would miss it and
            // certify a compensator GitHub will tolerate.
            const tolerated = other["continue-on-error"]
            if (tolerated !== undefined && tolerated !== false) return false
            // `typeof`, not `!== undefined`: `run: true` is a YAML boolean, and
            // it is exactly the no-op that must not count as a compensator.
            return typeof other.run === "string" && alwaysFails(other.run)
        })
    if (!compensator)
        throw teach(
            `Step "${name}" in ${WORKFLOW} is \`continue-on-error: true\` with no later step that re-fails the job on its outcome (a \`run:\` of \`exit <nonzero>\` or \`false\`, not itself \`continue-on-error\`), so CI tolerates its failure and verify would not.`,
        )
}

/** Fail closed on any key verify does not honour, at whichever level. Silently
 *  ignoring `shell:`, `defaults.run.working-directory:` or `container:` means
 *  executing something other than what CI executes and calling it green. */
const assertSupportedKeys = (
    node: Record<string, unknown>,
    where: string,
    supported: Set<string>,
    level: "workflow" | "job" | "step",
) => {
    const unsupported = Object.keys(node).filter(key => !supported.has(key))
    if (unsupported.length > 0)
        throw teach(
            `${where} in ${WORKFLOW} uses ${level} key(s) verify does not honour: ${unsupported.join(
                ", ",
            )}. Running anyway would execute something other than what CI executes.`,
        )
}

const assertReproducible = (step: WorkflowStep, name: string) => {
    const sources = [step.run ?? "", ...Object.values(step.env ?? {})]
    for (const source of sources) {
        if (source.includes("${{"))
            throw teach(
                `Step "${name}" in ${WORKFLOW} interpolates a GitHub expression (\`\${{ … }}\`), which only the runner can resolve.`,
            )
        const unsupported = [...source.matchAll(RUNNER_VARIABLE)]
            .map(match => match[1]!)
            .filter(variable => !SUPPORTED_RUNNER_VARIABLES.has(variable))
        if (unsupported.length > 0)
            throw teach(
                `Step "${name}" in ${WORKFLOW} reads runner variable(s) verify does not provide: ${[
                    ...new Set(unsupported),
                ].join(", ")}.`,
            )
    }
}

export const buildPlan = (workflowSource: string): Plan => {
    const workflow = yaml.parse(workflowSource) as {
        env?: Record<string, string>
        jobs?: Record<
            string,
            { env?: Record<string, string>; steps?: WorkflowStep[] }
        >
    }
    // Workflow-level `env:` would apply to every step; nothing sets it today,
    // so verify does not merge it. Fail rather than run the whole job with a
    // silently different environment than CI.
    if (workflow.env)
        throw teach(
            `${WORKFLOW} now declares workflow-level \`env:\`, which verify does not apply to steps.`,
        )
    assertSupportedKeys(
        workflow as Record<string, unknown>,
        WORKFLOW,
        SUPPORTED_WORKFLOW_KEYS,
        "workflow",
    )

    // Every declared job must be classified. Without this, a new required
    // pull-request job simply falls outside verify while it keeps reporting
    // green — the exact drift this command exists to prevent.
    const declared = Object.keys(workflow.jobs ?? {})
    const unclassified = declared.filter(
        job => !JOBS.includes(job) && SKIPPED_JOBS[job] === undefined,
    )
    if (unclassified.length > 0)
        throw teach(
            `${WORKFLOW} declares job(s) verify neither runs nor skips: ${unclassified.join(
                ", ",
            )}. Add them to JOBS if they gate pull requests, or to SKIPPED_JOBS with a reason.`,
        )
    const vanished = [...JOBS, ...Object.keys(SKIPPED_JOBS)].filter(
        job => !declared.includes(job),
    )
    if (vanished.length > 0)
        throw new Error(
            `scripts/verify.ts names job(s) that no longer exist in ${WORKFLOW}: ${vanished.join(
                ", ",
            )}. Update JOBS / SKIPPED_JOBS.`,
        )

    // Each skip reason is only true while the job's condition holds. Widening
    // or deleting `jobs.publish.if` would make it a pull-request job that
    // verify goes on skipping while claiming both PR jobs are covered — so
    // assert the condition, do not take the comment's word for it.
    for (const [jobName, policy] of Object.entries(SKIPPED_JOBS)) {
        const actual = (workflow.jobs?.[jobName] as { if?: string } | undefined)
            ?.if
        if (actual?.trim() !== policy.when)
            throw teach(
                `\`jobs.${jobName}\` in ${WORKFLOW} is skipped by verify because it is ${policy.reason}, which holds only while its condition is:\n` +
                    `    ${policy.when}\n` +
                    `but the workflow now says:\n` +
                    `    ${actual?.trim() ?? "(no `if:` at all)"}\n` +
                    `If it can now gate pull requests, move it to JOBS.`,
            )
    }

    const planned: PlannedStep[] = []
    const skipped: Plan["skipped"] = []
    const matchedPolicySkips = new Set<string>()
    const matchedActionSkips = new Set<string>()
    const alreadyRun = new Map<string, string>()

    for (const jobName of JOBS) {
        const job = workflow.jobs?.[jobName]
        const steps = job?.steps
        if (!steps?.length)
            throw new Error(
                `${WORKFLOW} has no \`jobs.${jobName}.steps\` — was the job renamed? scripts/verify.ts targets it by name.`,
            )
        if (job.env)
            throw teach(
                `\`jobs.${jobName}\` in ${WORKFLOW} now declares job-level \`env:\`, which verify does not apply to steps.`,
            )
        assertSupportedKeys(
            job as Record<string, unknown>,
            `jobs.${jobName}`,
            SUPPORTED_JOB_KEYS,
            "job",
        )

        // Verify executes every step through `bash -e`. That is a fair model of
        // a Linux runner and not of a Windows one, and a self-hosted label says
        // nothing at all about the environment — so validate the label rather
        // than assume. (Which OS the DEVELOPER is on is reported in preflight,
        // not blocked; see toolchainDrift for why the two differ.)
        const runsOn = (job as { "runs-on"?: unknown })["runs-on"]
        if (runsOn === undefined)
            throw teach(
                `\`jobs.${jobName}\` in ${WORKFLOW} declares no \`runs-on\`, so verify cannot tell which runner it models.`,
            )
        const labels = (Array.isArray(runsOn) ? runsOn : [runsOn]).map(String)
        const unsupportedRunner = labels.filter(
            label => !/^ubuntu-/.test(label),
        )
        if (unsupportedRunner.length > 0)
            throw teach(
                `\`jobs.${jobName}\` in ${WORKFLOW} runs on ${unsupportedRunner.join(
                    ", ",
                )}. Verify models a Linux runner (\`bash -e\`, GNU-ish utilities) and cannot faithfully replay that.`,
            )

        steps.forEach((step, index) => {
            const name =
                step.name ??
                (step.uses ? `uses: ${step.uses}` : `step ${index + 1}`)

            // `run: false` and `run: true` are YAML BOOLEANS, not the shell
            // commands they look like — a real trap, since `run: true` reads as
            // a no-op compensator. Anything non-string here would also crash
            // the string handling below, so reject it by shape.
            if (step.run !== undefined && typeof step.run !== "string")
                throw teach(
                    `Step "${name}" in ${WORKFLOW} has a non-string \`run: ${String(
                        step.run,
                    )}\` — YAML parsed it as ${typeof step.run}. Quote it ("${String(
                        step.run,
                    )}") if you meant the shell command.`,
                )

            // GitHub rejects a step declaring both, and `with:` means nothing
            // on a `run:` step. Verify would otherwise happily execute the
            // `run:` and report green for a workflow CI cannot even validate —
            // a false green for a file that never gets as far as failing.
            if (step.run !== undefined && step.uses !== undefined)
                throw teach(
                    `Step "${name}" in ${WORKFLOW} declares both \`run:\` and \`uses:\`. GitHub rejects that outright, so this workflow would not run at all.`,
                )
            if (step.run !== undefined && step.with !== undefined)
                throw teach(
                    `Step "${name}" in ${WORKFLOW} is a \`run:\` step carrying \`with:\`, which only applies to \`uses:\` steps.`,
                )

            // VALIDATE BEFORE CLASSIFYING, and before the run/uses split.
            // Every branch below can decide not to run the step, and a step
            // verify skips still shapes CI's behaviour — the failure
            // compensator is skipped here yet decides whether `Test` may be
            // treated as fatal.
            assertSupportedKeys(
                step as Record<string, unknown>,
                `Step "${name}"`,
                SUPPORTED_STEP_KEYS,
                "step",
            )

            // An action is only plumbing if someone said so about THIS step.
            // A permission keyed by action alone is a standing one: a second
            // `actions/github-script` step would ride in on the first one's
            // entry, recreating the gate-hidden-behind-`uses:` hole.
            if (step.run === undefined) {
                if (step.uses === undefined)
                    throw teach(
                        `Step "${name}" in \`jobs.${jobName}\` of ${WORKFLOW} has neither \`run:\` nor \`uses:\`.`,
                    )
                const action = step.uses.split("@")[0]!
                const key = `${jobName} / ${step.name ?? action}`
                const actionPolicy = SKIPPED_ACTIONS[key]
                if (actionPolicy === undefined)
                    throw teach(
                        `Step "${name}" in \`jobs.${jobName}\` of ${WORKFLOW} is an action step verify has no policy for (\`${key}\`). Actions can gate the job or set up state later steps need — add it to SKIPPED_ACTIONS with a reason, or give it a local equivalent.`,
                    )
                if (actionPolicy.action !== action)
                    throw teach(
                        `Step "${name}" in \`jobs.${jobName}\` of ${WORKFLOW} now uses \`${action}\`, but SKIPPED_ACTIONS was written for \`${actionPolicy.action}\`. Re-decide whether it still has no local equivalent.`,
                    )
                if (actionPolicy.config !== undefined) {
                    const digest = configDigest(step)
                    if (digest !== actionPolicy.config)
                        throw teach(
                            `Step "${name}" in \`jobs.${jobName}\` of ${WORKFLOW} runs caller-supplied code, and its configuration has changed (${actionPolicy.config} -> ${digest}).\n\n` +
                                `Verify skips it because: ${actionPolicy.reason}.\n\n` +
                                `Re-read the script. If it gained a failure path (\`core.setFailed\`, a throw) with no local equivalent, give it one — that is how the JUnit coverage gate came to exist. If the change is cosmetic, update the digest in SKIPPED_ACTIONS to ${digest}.`,
                        )
                }
                matchedActionSkips.add(key)
                skipped.push({
                    name,
                    reason: `\`${action}\` — ${actionPolicy.reason}`,
                })
                return
            }

            assertCompensated(step, name, steps, index)
            assertReproducible(step, name)

            // Bound to the job and the exact command, not just the display
            // name: a step keeping its name while gaining another gate, or a
            // second job reusing the name, must not inherit the skip.
            const policy = SKIPPED_STEPS[name]
            if (policy !== undefined) {
                if (policy.job !== jobName)
                    throw teach(
                        `Step "${name}" appears in \`jobs.${jobName}\` of ${WORKFLOW}, but the skip policy was written for \`jobs.${policy.job}\`.`,
                    )
                if (policy.run !== step.run)
                    throw teach(
                        `Step "${name}" in ${WORKFLOW} is skipped because it ${policy.reason}, but its command has changed:\n\n` +
                            `--- expected ---\n${policy.run}\n--- actual ---\n${step.run}\n\n` +
                            `Re-decide whether skipping it is still correct, then update SKIPPED_STEPS.`,
                    )
                matchedPolicySkips.add(name)
                skipped.push({ name, reason: policy.reason })
                return
            }

            if (step.if !== undefined) {
                const decision = evaluateIf(step.if)
                if (decision === null)
                    throw teach(
                        `Step "${name}" in \`jobs.${jobName}\` of ${WORKFLOW} has an \`if:\` verify cannot evaluate: ${step.if}`,
                    )
                if (!decision.run) {
                    skipped.push({ name, reason: decision.reason })
                    return
                }
            }

            // Skip a repeat only when it is an allowlisted setup command, from
            // a DIFFERENT job, with an identical environment. A repeat inside
            // one job is intentional, and the same command under different env
            // is a different command.
            const identity = `${step.run}\u0000${JSON.stringify(step.env ?? {})}`
            const priorJob = alreadyRun.get(identity)
            if (
                priorJob !== undefined &&
                priorJob !== jobName &&
                IDEMPOTENT_SETUP.has(step.run.trim())
            ) {
                skipped.push({
                    name: `${name} [${jobName}]`,
                    reason: `identical setup command already run in the \`${priorJob}\` job`,
                })
                return
            }
            if (priorJob === undefined) alreadyRun.set(identity, jobName)

            planned.push({
                name: JOBS.length > 1 ? `${name} [${jobName}]` : name,
                run: step.run,
                env: step.env ?? {},
            })
        })
    }

    const stale = Object.keys(SKIPPED_STEPS).filter(
        name => !matchedPolicySkips.has(name),
    )
    if (stale.length > 0)
        throw new Error(
            `SKIPPED_STEPS in scripts/verify.ts names step(s) that no longer exist in ${WORKFLOW}: ${stale.join(
                ", ",
            )}.\n\n` +
                `Renaming a skipped step would make verify start running it. Update the ` +
                `key, or drop it if the step is gone.`,
        )

    const staleActions = Object.keys(SKIPPED_ACTIONS).filter(
        key => !matchedActionSkips.has(key),
    )
    if (staleActions.length > 0)
        throw new Error(
            `SKIPPED_ACTIONS in scripts/verify.ts names action step(s) no covered job has: ${staleActions.join(
                ", ",
            )}.\n\n` +
                `A stale entry is a standing permission to ignore an action that may come ` +
                `back for a different reason. Drop it.`,
        )

    // Pins are tracked PER JOB, not pooled. Each covered job sets up its own
    // toolchain while verify runs them all under one local version, so pooling
    // hides the case that matters: a job dropping its setup action keeps the
    // other job's pin in the pool and preflight passes, even though that CI job
    // now runs on the runner default. Absent and conflicting are both fatal —
    // verify cannot claim parity with a version it does not know.
    const pins = (action: string, input: string): ToolPins =>
        Object.fromEntries(
            JOBS.map(name => [
                name,
                (workflow.jobs?.[name]?.steps ?? []).find(step =>
                    step.uses?.startsWith(action),
                )?.with?.[input],
            ]),
        )

    return {
        steps: planned,
        skipped,
        pinned: {
            bun: pins("oven-sh/setup-bun", "bun-version"),
            node: pins("actions/setup-node", "node-version"),
        },
        runners: [
            ...new Set(
                JOBS.flatMap(name => {
                    const on = (
                        workflow.jobs?.[name] as { "runs-on"?: unknown }
                    )?.["runs-on"]
                    return (Array.isArray(on) ? on : [on]).map(String)
                }),
            ),
        ],
    }
}

const localNodeVersion = async () => {
    try {
        const proc = Bun.spawn(["node", "--version"], {
            stdout: "pipe",
            stderr: "ignore",
        })
        const [out, code] = await Promise.all([
            new Response(proc.stdout).text(),
            proc.exited,
        ])
        return code === 0 ? out.trim().replace(/^v/, "") : undefined
    } catch {
        return undefined
    }
}

/** CI pins its toolchain through `uses:` steps verify cannot run, so check the
 *  gap here — and treat it as fatal, not advisory.
 *
 *  This is a genuine false-green path, not a nicety. Bundler output is
 *  toolchain-specific: the wrong Bun has already made the published-package
 *  size gate pass locally on a commit CI rejected (see
 *  scripts/toolchain-version.test.ts for the incident). That gate now runs
 *  inside verify, and the Node smokes in the same job execute whichever `node`
 *  is on PATH. A run on the wrong toolchain measured something other than what
 *  CI measures, so it may not claim CI would pass. */
export const toolchainDrift = (
    local: { bun: string | undefined; node: string | undefined; os?: string },
    pinned: Plan["pinned"],
    runners: string[] = [],
) => {
    const drift: string[] = []
    const lines: string[] = []
    const check = (
        label: string,
        installed: string | undefined,
        byJob: ToolPins,
    ) => {
        const unpinnedJobs = Object.keys(byJob).filter(
            job => byJob[job] === undefined,
        )
        if (unpinnedJobs.length > 0) {
            // That job runs on the runner default, which verify cannot know.
            drift.push(
                `${label.trim()} has no pin in ${unpinnedJobs.join(
                    ", ",
                )}, so that job runs on the runner default and verify cannot check it`,
            )
            lines.push(
                `  ✗ ${label} ${installed ?? "not found"} — no CI pin in ${unpinnedJobs.join(
                    ", ",
                )}`,
            )
            return
        }
        const candidates = [...new Set(Object.values(byJob) as string[])]
        if (candidates.length > 1) {
            // Verify runs every covered job under ONE local toolchain, so pins
            // that disagree cannot all be satisfied — validating against
            // whichever came first would be a false green for the other job.
            drift.push(
                `${label.trim()} is pinned to ${candidates.join(
                    " and ",
                )} by different covered jobs; one local version cannot replay both`,
            )
            lines.push(
                `  ✗ ${label} ${installed ?? "not found"} — CI pins conflict (${candidates.join(
                    ", ",
                )})`,
            )
            return
        }
        const pin = candidates[0]
        if (!pin) {
            // Absent is fatal too: verify cannot claim parity with a version it
            // does not know.
            drift.push(
                `${label.trim()} has no pin in the covered jobs, so verify cannot check it`,
            )
            lines.push(
                `  ✗ ${label} ${installed ?? "not found"} — CI pin missing`,
            )
            return
        }
        if (!installed) {
            drift.push(`${label.trim()} is not installed; CI pins ${pin}`)
            lines.push(`  ✗ ${label} not found — CI pins ${pin}`)
            return
        }
        // A pinned "24.16" is satisfied by 24.16.x, but not by 24.17 or 26.
        if (installed === pin || installed.startsWith(`${pin}.`)) {
            lines.push(`  ✓ ${label} ${installed}`)
            return
        }
        drift.push(`${label.trim()} is ${installed}; CI pins ${pin}`)
        lines.push(`  ✗ ${label} ${installed} — CI pins ${pin}`)
    }
    check("bun ", local.bun, pinned.bun)
    check("node", local.node, pinned.node)

    // The host OS is REPORTED, never blocking, and that is a deliberate split
    // from the version pins above. The divergence is real but narrow — CI runs
    // ubuntu-22.04 while most contributors here are on macOS, so a `run:` block
    // using a GNU-only flag can pass in one place and fail in the other.
    // Blocking would make verify unusable on the primary dev platform, and a
    // flag everyone passes on every run would neuter the Bun/Node checks along
    // with it. So: name it every run rather than let it be invisible.
    if (runners.length > 0 && local.os && local.os !== "linux")
        lines.push(
            `  · host ${local.os} — CI runs ${runners.join(
                ", ",
            )}; shell utilities differ (BSD vs GNU)`,
        )

    return { drift, lines }
}

const checkToolchain = async (plan: Plan) => {
    const { drift, lines } = toolchainDrift(
        {
            bun: Bun.version,
            node: await localNodeVersion(),
            os: process.platform === "darwin" ? "macOS" : process.platform,
        },
        plan.pinned,
        plan.runners,
    )
    console.log("Toolchain")
    for (const line of lines) console.log(line)
    return drift
}

const duration = (ms: number) =>
    ms < 60_000
        ? `${(ms / 1000).toFixed(1)}s`
        : `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`

const indent = (text: string) => text.trimEnd().replace(/^/gm, "    ")

/** Resolve `--from=` to a zero-based index, or null when nothing matches (the
 *  caller reports and exits — returning null keeps this pure enough to test). */
export const resolveStart = (
    steps: PlannedStep[],
    from: string | undefined,
): number | null => {
    if (from === undefined) return 0
    // Whole-string match only. `parseInt` would read "2oops" as 2 and silently
    // skip the first step instead of reporting a malformed argument.
    if (/^\d+$/.test(from)) {
        const index = Number.parseInt(from, 10)
        if (index >= 1 && index <= steps.length) return index - 1
        return null
    }
    const needle = from.toLowerCase()
    const match = steps.findIndex(step =>
        step.name.toLowerCase().includes(needle),
    )
    return match === -1 ? null : match
}

export type StepResult = {
    index: number
    step: PlannedStep
    code: number
}

export type RunOutcome = {
    results: StepResult[]
    failed?: StepResult
}

/** Execute planned steps the way the runner does, stopping at the first
 *  failure. Split out of the CLI so the execution half — bash semantics, env
 *  merging, RUNNER_TEMP, exit codes, `--from` numbering — is testable rather
 *  than only ever exercised by a real 15-step run. */
export const runSteps = async (
    steps: PlannedStep[],
    options: {
        runnerTemp: string
        start?: number
        cwd?: string
        log?: (line: string) => void
        stdio?: "inherit" | "ignore"
    },
): Promise<RunOutcome> => {
    const {
        runnerTemp,
        start = 0,
        cwd = root,
        log = console.log,
        stdio = "inherit",
    } = options
    const results: StepResult[] = []

    for (let i = start; i < steps.length; i++) {
        const step = steps[i]!
        // Numbering is always against the whole plan, never the slice, so a
        // `--from` run cannot look like a complete one.
        const label = `${i + 1}/${steps.length}  ${step.name}`
        log(`▸ ${label}`)
        log(indent(step.run))

        const scriptPath = join(runnerTemp, `step-${i + 1}.sh`)
        await writeFile(scriptPath, step.run)
        const startedAt = performance.now()
        // GitHub's default shell for `run:` on Linux is `bash -e {0}` — a file,
        // not `-c`, so `$0` and heredocs behave identically here.
        const proc = Bun.spawn(["bash", "-e", scriptPath], {
            cwd,
            env: { ...process.env, RUNNER_TEMP: runnerTemp, ...step.env },
            stdio: [stdio, stdio, stdio],
        })
        const code = await proc.exited
        const took = duration(performance.now() - startedAt)
        const result = { index: i, step, code }
        results.push(result)

        if (code !== 0) {
            log(`✗ ${label}  ${took}  (exit ${code})\n`)
            return { results, failed: result }
        }
        log(`✓ ${label}  ${took}\n`)
    }
    return { results }
}

if (import.meta.main) {
    const args = process.argv.slice(2)
    const listOnly = args.includes("--list")
    const allowDrift = args.includes("--allow-toolchain-drift")
    const from = args
        .find(arg => arg.startsWith("--from="))
        ?.slice("--from=".length)

    const plan = buildPlan(await Bun.file(join(root, WORKFLOW)).text())

    console.log(
        `\n${WORKFLOW} — job(s) ${JOBS.map(job => `\`${job}\``).join(", ")}\n`,
    )
    const drift = await checkToolchain(plan)

    // `--list` runs nothing, so it cannot report a false green and stays
    // informational. An actual run on the wrong toolchain measured something
    // other than what CI measures, so it must not claim CI would pass.
    if (drift.length > 0 && !listOnly && !allowDrift) {
        console.error(
            `\nToolchain does not match CI:\n` +
                drift.map(item => `    · ${item}`).join("\n") +
                `\n\nThe pinned Bun is in \`.bun-version\` — bundler output is version-specific,\n` +
                `and the published-package size gate has already passed locally on a commit CI\n` +
                `rejected. The Node smokes in that same job run whichever \`node\` is on PATH.\n\n` +
                `    bun run verify --list                     # plan only, no toolchain needed\n` +
                `    bun run verify --allow-toolchain-drift    # run anyway; results may not match CI`,
        )
        process.exit(2)
    }

    const policySkips = plan.skipped.filter(
        skip => SKIPPED_STEPS[skip.name] !== undefined,
    )
    if (policySkips.length > 0) {
        console.log(`\nNot running ${policySkips.length} step(s):`)
        for (const skip of policySkips)
            console.log(indent(`✗ ${skip.name}\n    ${skip.reason}`))
    }

    console.log(`\nNot covered by verify — run these separately:`)
    for (const gate of NOT_COVERED) console.log(`    · ${gate}`)

    if (listOnly) {
        console.log(`\n${plan.steps.length} step(s), in this order:\n`)
        plan.steps.forEach((step, i) => {
            console.log(`${String(i + 1).padStart(2)}. ${step.name}`)
            console.log(indent(step.run))
            console.log("")
        })
        process.exit(0)
    }

    const start = resolveStart(plan.steps, from)
    if (start === null) {
        console.error(`No step matches --from=${from}. Steps in the plan:\n`)
        plan.steps.forEach((step, i) =>
            console.error(`  ${i + 1}. ${step.name}`),
        )
        process.exit(2)
    }
    console.log(
        `\n${plan.steps.length - start} step(s) to run${
            start > 0 ? ` (resuming at ${start + 1})` : ""
        }\n`,
    )

    const runnerTemp = await mkdtemp(join(tmpdir(), "valdres-verify-"))
    const startedAt = performance.now()
    let failed: StepResult | undefined

    try {
        failed = (await runSteps(plan.steps, { runnerTemp, start })).failed
    } finally {
        await rm(runnerTemp, { recursive: true, force: true })
    }

    const total = duration(performance.now() - startedAt)
    if (failed) {
        console.error(
            `Failed at step ${failed.index + 1} of ${plan.steps.length}: ${
                failed.step.name
            }  (${total} elapsed)\n\n` +
                `    bun run verify --from=${failed.index + 1}    # re-run from here`,
        )
        process.exit(1)
    }
    // Only a run that started at step 1 can claim the job passed. `--from`
    // skipped everything before it, so say that instead of implying CI parity.
    console.log(
        start > 0
            ? `Steps ${start + 1}–${plan.steps.length} passed in ${total}. ` +
                  `Steps 1–${start} were SKIPPED by --from, so this is not a full run — ` +
                  `re-run \`bun run verify\` before opening the PR.`
            : `All ${plan.steps.length} step(s) passed in ${total} — ${JOBS.map(
                  job => `\`${job}\``,
              ).join(" + ")} minus the publish dry-run. Not covered: ${
                  NOT_COVERED.length
              } gate(s) listed above.${
                  drift.length > 0
                      ? `\n\nWARNING: ran on a toolchain that does not match CI (${drift.join(
                            "; ",
                        )}). This is not evidence CI will pass.`
                      : ""
              }`,
    )
}
