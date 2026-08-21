import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const workflow = (name: string) =>
    readFileSync(join(import.meta.dir, `../.github/workflows/${name}`), "utf8")

const measurementWorkflow = workflow("bencher-pr.yml")
const gateWorkflow = workflow("bencher-pr-gate.yml")
const deepWorkflow = workflow("bencher-deep.yml")
const ciWorkflow = workflow("ci.yaml")
const generatedDocsWorkflows = [
    workflow("bench-table.yml"),
    workflow("gen-readmes.yml"),
]

function jobNames(source: string): string[] {
    const jobs = source.match(/^jobs:\n([\s\S]*)$/m)?.[1] ?? ""
    return [...jobs.matchAll(/^    ([a-z][a-z0-9_]*):$/gm)].map(
        match => match[1],
    )
}

function jobBlock(source: string, name: string): string {
    const marker = `    ${name}:\n`
    const start = source.indexOf(marker)
    if (start === -1) return ""
    const remaining = source.slice(start + marker.length)
    const next = remaining.search(/^    [a-z][a-z0-9_]*:\n/m)
    return next === -1
        ? source.slice(start)
        : source.slice(start, start + marker.length + next)
}

describe("fork-safe PR benchmark measurement", () => {
    test("runs every PR in an unprivileged workflow", () => {
        expect(measurementWorkflow).toMatch(
            /^name: Bencher \(PR measurement\)$/m,
        )
        const trigger = measurementWorkflow.match(
            /^on:\n([\s\S]*?)\npermissions:/m,
        )
        expect(trigger).not.toBeNull()
        expect(trigger![1]).toContain("pull_request:")
        expect(trigger![1]).toContain("branches: [main]")
        expect(trigger![1]).toContain(
            "types: [opened, synchronize, reopened, labeled]",
        )
        expect(trigger![1]).not.toMatch(/paths(?:-ignore)?:/)
        expect(measurementWorkflow).toContain(
            "permissions:\n    contents: read",
        )
        expect(measurementWorkflow).not.toContain("BENCHER_API_KEY")
        expect(measurementWorkflow).not.toContain("environment: Bencher.dev")
        expect(measurementWorkflow).not.toContain("bencherdev/bencher")
        expect(measurementWorkflow).not.toContain("github.actor")
        expect(measurementWorkflow).not.toContain(
            "head.repo.full_name == github.repository",
        )
    })

    test("classifies with trusted-base code and uploads minimal context", () => {
        const classify = jobBlock(measurementWorkflow, "classify_changes")
        expect(classify).toContain(
            '"${BASE_SHA}:scripts/lib/benchmark-change-scope.mjs"',
        )
        expect(classify).toContain("git cat-file -e")
        expect(classify).toContain("--name-status")
        expect(classify).toContain("--find-copies-harder")
        expect(classify).toContain('node "$classifier"')
        expect(classify).toContain(
            "contains(github.event.pull_request.labels.*.name,",
        )
        expect(classify).toContain("'run-benchmarks'")
        expect(classify).toContain("name: benchmark-context")
        expect(classify).toContain("schemaVersion: 1")
        expect(classify).toContain("testedTestMergeSha")
        expect(classify).toContain("runBenchmarks")
    })

    test("measures forks without a secret or same-repository guard", () => {
        const run = jobBlock(measurementWorkflow, "run_benchmarks")
        expect(run).toContain(
            "needs.classify_changes.outputs.run_benchmarks == 'true'",
        )
        expect(run).not.toContain("head.repo.full_name")
        expect(run).not.toContain("dependabot")
        expect(run).not.toContain("secrets.")
        expect(run).toContain("bun install --frozen-lockfile")
        expect(run).toContain("persist-credentials: false")
    })

    test("uses the calibrated balanced ladder", () => {
        const run = jobBlock(measurementWorkflow, "run_benchmarks")
        const block = run.match(
            /run_block\(\) \{[\s\S]*?\n                  \}/,
        )
        expect(block).not.toBeNull()
        const sides = [
            ...block![0].matchAll(
                /run_suite "\$[ab]" "\$runtime" "\$suite" (base|head) (\d)/g,
            ),
        ].map(match => `${match[1]}@${match[2]}`)
        expect(sides).toEqual(["base@1", "head@2", "head@1", "base@2"])
        expect(run).toContain('BENCH_MAX_ROUNDS: "3"')
        expect(run).toContain('run_block "$round" 1')
        expect(run).toContain('run_block "$round" 2')
        expect(run).toContain('if [[ "$round" == "1" ]]')
        expect(run).toContain('"$gate" 0')
        expect(run).toContain("BENCH_RERUN_LANES_FILE=/tmp/rerun-lanes")
        expect(run).toContain('"$completed" -ge "$BENCH_MAX_ROUNDS"')
    })

    test("retains exactly the first three pairs for the old backstop", () => {
        const run = jobBlock(measurementWorkflow, "run_benchmarks")
        expect(run).toContain("gate_${side}_${runtime}.ndjson")
        expect(run).toContain(
            'run_block "$round" 1 "$runtime" "$suite" "$gate" "$gate"',
        )
        expect(run).toContain(
            'run_block "$round" 2 "$runtime" "$suite" "$gate" 0',
        )
        expect(3 * 2 * 2 * 2).toBe(24)
    })

    test("copies the complete current harness into the base worktree", () => {
        expect(measurementWorkflow).toContain("rsync -a --delete")
        expect(measurementWorkflow).toContain(
            '"$GITHUB_WORKSPACE/packages/valdres/test/performance/"',
        )
        expect(measurementWorkflow).toContain(
            "vitest.architecture-bench.config.ts",
        )
        expect(measurementWorkflow).toContain("vitest.async-bench.config.ts")
    })
})

describe("trusted workflow_run benchmark gate", () => {
    test("preserves the required check identity", () => {
        expect(gateWorkflow).toMatch(/^name: Bencher \(PR\)$/m)
        expect(jobNames(gateWorkflow)).toEqual(["benchmark_pr"])
        expect(gateWorkflow).toContain("name: 'benchmark_pr'")
        expect(gateWorkflow).toContain("head_sha: headSha")
        expect(gateWorkflow).toContain("checks.update")
    })

    test("is chained only from the measurement workflow", () => {
        const trigger = gateWorkflow.match(/^on:\n([\s\S]*?)\npermissions:/m)
        expect(trigger).not.toBeNull()
        expect(trigger![1]).toContain("workflow_run:")
        expect(trigger![1]).toContain("workflows: [Bencher (PR measurement)]")
        expect(trigger![1]).toContain("types: [completed]")
        expect(trigger![1]).not.toContain("pull_request:")
    })

    test("uses a bounded concurrency identity for fork branches", () => {
        const concurrency = gateWorkflow.match(
            /^concurrency:\n([\s\S]*?)\njobs:/m,
        )
        expect(concurrency).not.toBeNull()
        expect(concurrency![1]).toContain("pull_requests[0].number")
        expect(concurrency![1]).toContain("head_repository.id")
        expect(concurrency![1]).toContain("workflow_run.id")
        expect(concurrency![1]).not.toContain("head_repository.full_name")
        expect(concurrency![1]).not.toContain("head_branch")
    })

    test("downloads artifacts from the exact triggering run", () => {
        expect(
            gateWorkflow.match(/actions\/download-artifact@v4/g),
        ).toHaveLength(2)
        expect(
            gateWorkflow.match(
                /run-id: \$\{\{ github\.event\.workflow_run\.id \}\}/g,
            ),
        ).toHaveLength(2)
        expect(gateWorkflow).toContain("name: benchmark-context")
        expect(gateWorkflow).toContain("name: benchmark-evidence")
        expect(gateWorkflow).not.toContain("dawidd6/")
    })

    test("validates artifact identity before privileged use", () => {
        expect(gateWorkflow).toContain("envelope.headSha !== run.head_sha")
        expect(gateWorkflow).toContain(
            "String(envelope.runId) !== String(run.id)",
        )
        expect(gateWorkflow).toContain("github.rest.pulls.get")
        expect(gateWorkflow).toContain("pr.head.sha !== envelope.headSha")
        expect(gateWorkflow).toContain(
            "pr.head.repo.full_name !== run.head_repository.full_name",
        )
        expect(gateWorkflow).toContain('bytes" -gt 20000000')
        expect(gateWorkflow).toContain('"$(wc -c < "$round_path")" -gt 8')
    })

    test("executes only the trusted default-branch implementation", () => {
        expect(gateWorkflow).toContain("ref: main")
        expect(gateWorkflow).not.toContain("github.event.pull_request")
        expect(gateWorkflow).not.toContain("github.head_ref")
        expect(gateWorkflow).not.toContain("testedTestMergeSha }}")
    })

    test("makes the paired model independently blocking", () => {
        expect(gateWorkflow).toContain('BENCH_ENFORCE: "1"')
        expect(gateWorkflow).toContain("bun run scripts/bench-paired-report.ts")
        expect(gateWorkflow).toContain("PAIRED_GATE:")
        expect(gateWorkflow).toContain("['paired ~10% gate'")
    })

    test("retains the exact +50% Bencher backstop", () => {
        expect(
            gateWorkflow.match(/--threshold-upper-boundary 0\.5/g),
        ).toHaveLength(2)
        expect(gateWorkflow.match(/--err/g)).toHaveLength(2)
        expect(gateWorkflow).toContain("gate_base_bun.ndjson")
        expect(gateWorkflow).toContain("gate_head_node.ndjson")
        expect(gateWorkflow).toContain('--hash "$HEAD_SHA"')
        expect(gateWorkflow).toContain('--ci-number "$PR_NUMBER"')
    })

    test("scopes secrets to the trusted workflow", () => {
        expect(measurementWorkflow).not.toContain("secrets.")
        expect(gateWorkflow.match(/BENCHER_API_KEY:/g)).toHaveLength(3)
        expect(gateWorkflow).toContain("environment: Bencher.dev")
    })
})

describe("trusted generated-documentation pushes", () => {
    test.each(generatedDocsWorkflows)(
        "pre-authorizes the exact generated commit before advancing main",
        source => {
            expect(source).toContain(
                "permissions:\n    checks: write\n    contents: write",
            )
            expect(source).toContain(
                'git push origin "HEAD:refs/heads/${holding_branch}"',
            )
            expect(source).toContain('"repos/${GITHUB_REPOSITORY}/check-runs"')
            expect(source).toContain("-f name=benchmark_pr")
            expect(source).toContain('-f head_sha="$(git rev-parse HEAD)"')

            const publishHolding = source.indexOf(
                'git push origin "HEAD:refs/heads/${holding_branch}"',
            )
            const createCheck = source.indexOf(
                '"repos/${GITHUB_REPOSITORY}/check-runs"',
            )
            const publishMain = source.indexOf("git push origin HEAD:main")
            const cleanup = source.indexOf(
                'git push origin --delete "$holding_branch"',
            )
            expect(publishHolding).toBeLessThan(createCheck)
            expect(createCheck).toBeLessThan(publishMain)
            expect(publishMain).toBeLessThan(cleanup)
        },
    )
})

describe("trusted generated-release pull requests", () => {
    test("pre-authorizes only the exact allowlisted Changesets commit", () => {
        const publish = jobBlock(ciWorkflow, "publish")
        expect(publish).toContain(
            "permissions:\n            checks: write\n            contents: write",
        )
        expect(publish).toContain("id: changesets")
        expect(publish).toContain(
            "if: steps.changesets.outputs.pr-number != ''",
        )
        // The local-clone checks below only hold while the action pushes the
        // release commit with the Git CLI. changesets/action@v2 defaults to
        // pushing through the GitHub API, which never checks the release
        // branch out, so dropping this input silently breaks the gate.
        expect(publish).toContain("push-with-git-cli: true")
        expect(publish).toContain(
            "exec.getExecOutput('git', ['rev-parse', 'HEAD']",
        )
        expect(publish).toContain("releaseBranch !== 'changeset-release/main'")
        expect(publish).toContain("attempt <= 15")
        expect(publish).toContain("candidate.head.sha === releaseSha")
        expect(publish).toContain("branch.object.sha === releaseSha")
        expect(publish).toContain("candidate.state !== 'open'")
        expect(publish).toContain("files.length === 0 || files.length > 500")
        expect(publish).toContain("path === '.changeset/pre.json'")
        expect(publish).toContain("(?:pre\\/)?[a-z0-9-]+\\.md")
        expect(publish).toContain("path === 'bun.lock'")
        expect(publish).toContain("CHANGELOG\\.md|package\\.json")
        expect(publish).toContain(
            "Refusing benchmark check for non-release files",
        )
        expect(publish).toContain("name: 'benchmark_pr'")
        expect(publish).toContain("head_sha: releaseSha")

        const changesets = publish.indexOf("uses: changesets/action@v2")
        const localSha = publish.indexOf("exec.getExecOutput('git', [")
        const remoteRef = publish.indexOf("github.rest.git.getRef")
        const changedFiles = publish.indexOf("github.rest.pulls.listFiles")
        const createCheck = publish.indexOf("name: 'benchmark_pr'")
        expect(changesets).toBeLessThan(localSha)
        expect(localSha).toBeLessThan(remoteRef)
        expect(remoteRef).toBeLessThan(changedFiles)
        expect(changedFiles).toBeLessThan(createCheck)
    })
})

describe("deep benchmark workflow", () => {
    test("runs only manually and weekly, never for pull requests", () => {
        expect(deepWorkflow).toMatch(/^name: Bencher \(deep\)$/m)
        const trigger = deepWorkflow.match(/^on:\n([\s\S]*?)\npermissions:/m)
        expect(trigger).not.toBeNull()
        expect(trigger![1]).toContain("workflow_dispatch:")
        expect(trigger![1]).toContain("schedule:")
        expect(trigger![1]).not.toContain("pull_request")
        expect(jobNames(deepWorkflow)).toEqual(["benchmark_deep"])
    })

    test("cannot access or mutate Bencher", () => {
        expect(deepWorkflow).not.toContain("BENCHER_API_KEY")
        expect(deepWorkflow).not.toContain("environment: Bencher.dev")
        expect(deepWorkflow).not.toContain("bencherdev/bencher")
        expect(deepWorkflow).not.toMatch(/\bbencher run\b/)
        expect(deepWorkflow).not.toContain("start-point-reset")
        expect(deepWorkflow).not.toContain("threshold-upper-boundary")
        expect(deepWorkflow).not.toContain("--err")
    })

    test("validates refs and records immutable resolved SHAs", () => {
        expect(deepWorkflow).toContain("git check-ref-format --branch")
        expect(deepWorkflow).toContain(
            'git rev-parse --verify "${candidate}^{commit}"',
        )
        expect(deepWorkflow).toContain('echo "base_sha=${base_sha}"')
        expect(deepWorkflow).toContain('echo "head_sha=${head_sha}"')
        expect(deepWorkflow).toContain(
            '"$EVENT_NAME" == "schedule" && "$base_sha" != "$head_sha"',
        )
    })

    test("records inputs before ref validation can fail", () => {
        const resolve = deepWorkflow.match(
            /- name: Resolve immutable comparison SHAs[\s\S]*?(?=\n            - name:)/,
        )
        expect(resolve).not.toBeNull()
        expect(resolve![0]).toContain("mkdir -p /tmp/deep-artifacts")
        expect(resolve![0]).toContain("execution-context.txt")
        expect(resolve![0].indexOf("execution-context.txt")).toBeLessThan(
            resolve![0].indexOf("resolve_ref()"),
        )
    })

    test("copies the full current harness into both worktrees", () => {
        expect(deepWorkflow).toContain(
            "for checkout in /tmp/deep-base /tmp/deep-head",
        )
        expect(deepWorkflow).toContain("rsync -a --delete")
        expect(deepWorkflow).toContain("vitest.architecture-bench.config.ts")
        expect(deepWorkflow).toContain("vitest.async-bench.config.ts")
    })

    test("uses balanced B-P-P-B blocks and a hard round cap", () => {
        const block = deepWorkflow.match(
            /run_block\(\) \{[\s\S]*?\n                  \}/,
        )
        expect(block).not.toBeNull()
        const sides = [
            ...block![0].matchAll(
                /run_suite "\$[ab]" "\$runtime" "\$suite" (base|head) (\d)/g,
            ),
        ].map(match => `${match[1]}@${match[2]}`)
        expect(sides).toEqual(["base@1", "head@2", "head@1", "base@2"])
        expect(deepWorkflow).toContain(
            'if [[ ! "$MAX_ROUNDS_INPUT" =~ ^[123]$ ]]',
        )
        expect(deepWorkflow).toContain('"$completed" -ge "$BENCH_MAX_ROUNDS"')
    })

    test("keeps weekly decisions advisory but parsing failures fatal", () => {
        expect(deepWorkflow).toContain("bun run scripts/bench-paired-report.ts")
        expect(deepWorkflow).not.toContain("continue-on-error: true")
        expect(deepWorkflow).not.toMatch(/outcome.*regression/)
        expect(deepWorkflow.match(/GITHUB_STEP_SUMMARY/g)).toHaveLength(1)
    })

    test("retains complete calibration evidence for 90 days", () => {
        expect(deepWorkflow).toContain("observations/base_bun.ndjson")
        expect(deepWorkflow).toContain("decisions/round-${round}.json")
        expect(deepWorkflow).toContain("paired-report.md")
        expect(deepWorkflow).toContain("execution-context.txt")
        expect(deepWorkflow).toContain("toolchain-versions.txt")
        expect(deepWorkflow).toContain("base-dependencies.txt")
        expect(deepWorkflow).toContain("head-dependencies.txt")
        expect(deepWorkflow).toContain("retention-days: 90")
        expect(deepWorkflow).toContain("cancel-in-progress: false")
    })
})
