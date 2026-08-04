import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const prWorkflow = readFileSync(
    join(import.meta.dir, "../.github/workflows/bencher-pr.yml"),
    "utf8",
)
const deepWorkflow = readFileSync(
    join(import.meta.dir, "../.github/workflows/bencher-deep.yml"),
    "utf8",
)

function jobNames(workflow: string): string[] {
    const jobs = workflow.match(/^jobs:\n([\s\S]*)$/m)?.[1] ?? ""
    return [...jobs.matchAll(/^    ([a-z][a-z0-9_]*):$/gm)].map(
        match => match[1],
    )
}

function jobBlock(workflow: string, name: string): string {
    const marker = `    ${name}:\n`
    const start = workflow.indexOf(marker)
    if (start === -1) return ""
    const remaining = workflow.slice(start + marker.length)
    const next = remaining.search(/^    [a-z][a-z0-9_]*:\n/m)
    return next === -1
        ? workflow.slice(start)
        : workflow.slice(start, start + marker.length + next)
}

describe("fast Bencher PR workflow", () => {
    test("preserves the required workflow and final check identity", () => {
        expect(prWorkflow).toMatch(/^name: Bencher \(PR\)$/m)
        expect(jobNames(prWorkflow)).toEqual([
            "classify_changes",
            "run_benchmarks",
            "benchmark_pr",
        ])
        expect(jobBlock(prWorkflow, "benchmark_pr")).toContain("if: always()")
    })

    test("triggers every PR to main without a workflow path filter", () => {
        const trigger = prWorkflow.match(/^on:\n([\s\S]*?)\npermissions:/m)
        expect(trigger).not.toBeNull()
        expect(trigger![1]).toContain("pull_request:")
        expect(trigger![1]).toContain("branches: [main]")
        expect(trigger![1]).toContain(
            "types: [opened, synchronize, reopened, labeled]",
        )
        expect(trigger![1]).not.toMatch(/paths(?:-ignore)?:/)
    })

    test("serializes the stable numeric per-PR Bencher branch", () => {
        expect(prWorkflow).toContain(
            "group: bencher-pr-${{ github.event.pull_request.number }}",
        )
        expect(prWorkflow).toContain("cancel-in-progress: false")
        expect(prWorkflow).toContain(
            "BENCHER_BRANCH: pr-${{ github.event.pull_request.number }}",
        )
        expect(prWorkflow).not.toContain("github.head_ref")
    })

    test("measures exactly three alternating pairs", () => {
        const pairLoop = prWorkflow.match(
            /for pair in ([^;]+); do([\s\S]*?)\n                  done/,
        )
        expect(pairLoop).not.toBeNull()
        expect(pairLoop![1].trim().split(/\s+/)).toEqual(["1", "2", "3"])
        expect(pairLoop![2]).toContain('if [[ "$pair" == "2" ]]')
        expect(pairLoop![2]).toContain("pair_order=(head base)")
        expect(pairLoop![2]).toContain("pair_order=(base head)")
        expect(pairLoop![2]).toContain("for runtime in bun node")
        expect(pairLoop![2]).toContain("for suite in standard async")
        expect(pairLoop![2]).toContain('for side in "${pair_order[@]}"')
        expect(3 * 2 * 2 * 2).toBe(24)
    })

    test("keeps explicit fail-closed observation metadata", () => {
        expect(prWorkflow).toContain('export BENCH_PAIR_ID="pair-${pair}-')
        expect(prWorkflow).toContain('export BENCH_SIDE="$side"')
        expect(prWorkflow).toContain('export BENCH_ORDER="$order"')
        expect(prWorkflow).toContain('export BENCH_SUITE="$suite"')
        expect(prWorkflow).toContain("BENCH_VALDRES_ONLY=1")
        expect(prWorkflow).toContain("BENCH_EXCLUDE_REFS")
        expect(prWorkflow).toContain("BENCH_EXCLUDE_TINY")
    })

    test("feeds the gate only the three raw pair files", () => {
        expect(prWorkflow).toContain("BENCH_NDJSON_BUN=/tmp/head_bun.ndjson")
        expect(prWorkflow).toContain(
            "BENCH_PAIRED_BASE_BUN=/tmp/base_bun.ndjson",
        )
        expect(prWorkflow).toContain(
            "BENCH_PAIRED_BASE_NODE=/tmp/base_node.ndjson",
        )
        expect(prWorkflow).toContain("--threshold-upper-boundary 0.5")
        expect(prWorkflow.match(/--err/g)).toHaveLength(2)
    })

    test("contains no fourth pair, analyzer, or rerun ladder", () => {
        expect(prWorkflow).not.toContain("BENCH_MAX_ROUNDS")
        expect(prWorkflow).not.toContain("bench-paired-report")
        expect(prWorkflow).not.toContain("all_base_")
        expect(prWorkflow).not.toContain("run_round")
        expect(prWorkflow).not.toContain("run_block")
        expect(prWorkflow).not.toContain("paired-report")
    })

    test("copies the complete current harness into the base worktree", () => {
        expect(prWorkflow).toContain("rsync -a --delete")
        expect(prWorkflow).toContain(
            '"$GITHUB_WORKSPACE/packages/valdres/test/performance/"',
        )
        expect(prWorkflow).toContain("vitest.architecture-bench.config.ts")
        expect(prWorkflow).toContain("vitest.async-bench.config.ts")
    })

    test("records the checked-out test-merge SHA accurately", () => {
        expect(prWorkflow).toContain("TESTED_SHA: ${{ github.sha }}")
        expect(prWorkflow).toContain("tested_test_merge_sha=${TESTED_SHA}")
        expect(prWorkflow).not.toContain("PR head")
    })

    test("scopes the Bencher API key to seed and gate steps", () => {
        expect(prWorkflow.match(/BENCHER_API_KEY:/g)).toHaveLength(3)
        const prefix = prWorkflow.slice(
            0,
            prWorkflow.indexOf("- name: Seed relative baseline"),
        )
        expect(prefix).not.toContain("BENCHER_API_KEY")
    })

    test("classifies exact base/head changes with preinstalled Node only", () => {
        const classify = jobBlock(prWorkflow, "classify_changes")
        expect(classify).toContain(
            "BASE_SHA: ${{ github.event.pull_request.base.sha }}",
        )
        expect(classify).toContain(
            "HEAD_SHA: ${{ github.event.pull_request.head.sha }}",
        )
        expect(classify).toContain("--name-status")
        expect(classify).toContain("-z")
        expect(classify).toContain("--find-copies-harder")
        expect(classify).toContain('"$BASE_SHA...$HEAD_SHA"')
        expect(classify).toContain(
            '"${BASE_SHA}:scripts/lib/benchmark-change-scope.mjs"',
        )
        expect(classify).toContain("git cat-file -e")
        expect(classify).toContain(
            'classifier="$GITHUB_WORKSPACE/scripts/lib/benchmark-change-scope.mjs"',
        )
        expect(classify).toContain('node "$classifier"')
        expect(classify).not.toContain("setup-bun")
        expect(classify).not.toContain("setup-node")
        expect(classify).not.toContain("environment:")
        expect(classify).not.toContain("${{ secrets.")
    })

    test("the run-benchmarks label forces classification", () => {
        expect(jobBlock(prWorkflow, "classify_changes")).toContain(
            "contains(github.event.pull_request.labels.*.name,",
        )
        expect(prWorkflow).toContain("'run-benchmarks'")
    })

    test("only the measurement job owns the Bencher environment", () => {
        expect(jobBlock(prWorkflow, "run_benchmarks")).toContain(
            "environment: Bencher.dev",
        )
        expect(jobBlock(prWorkflow, "classify_changes")).not.toContain(
            "Bencher.dev",
        )
        expect(jobBlock(prWorkflow, "benchmark_pr")).not.toContain(
            "Bencher.dev",
        )
    })

    test("the sentinel propagates classification and measurement failures", () => {
        const sentinel = jobBlock(prWorkflow, "benchmark_pr")
        expect(sentinel).toContain(
            'if [[ "$CLASSIFICATION_RESULT" != "success" ]]',
        )
        expect(sentinel).toContain('if [[ "$BENCHMARK_RESULT" == "success" ]]')
        expect(sentinel).toContain(
            'echo "::error::Requested benchmark result: ${BENCHMARK_RESULT}"',
        )
        expect(sentinel.match(/exit 1/g)!.length).toBeGreaterThanOrEqual(4)
    })

    test("the sentinel succeeds only for explicit safe skips", () => {
        const sentinel = jobBlock(prWorkflow, "benchmark_pr")
        expect(sentinel).toContain('if [[ "$RUN_BENCHMARKS" == "false" ]]')
        expect(sentinel).toContain('if [[ "$SAME_REPOSITORY" != "true" ]]')
        expect(sentinel).toContain('if [[ "$IS_DEPENDABOT" == "true" ]]')
        expect(sentinel).toContain("Benchmarks intentionally skipped")
        expect(sentinel).toContain("Benchmarks skipped for fork pull request")
        expect(sentinel).toContain("Benchmarks skipped for Dependabot")
    })

    test("irrelevant changes cannot request the environment or dependencies", () => {
        const run = jobBlock(prWorkflow, "run_benchmarks")
        expect(run).toContain(
            "needs.classify_changes.outputs.run_benchmarks == 'true'",
        )
        expect(run).toContain("environment: Bencher.dev")
        expect(run).toContain("setup-bun")
        expect(run).toContain("bun install --frozen-lockfile")
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

    test("uses balanced B-P-P-B blocks", () => {
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
        expect(deepWorkflow.match(/run_block "\$round" [12]/g)).toHaveLength(2)
    })

    test("has four-pair round one and a hard three-round cap", () => {
        expect(deepWorkflow).toContain('options:\n                    - "1"')
        expect(deepWorkflow).toContain('                    - "2"')
        expect(deepWorkflow).toContain('                    - "3"')
        expect(deepWorkflow).toContain(
            'if [[ ! "$MAX_ROUNDS_INPUT" =~ ^[123]$ ]]',
        )
        expect(deepWorkflow).toContain('"$completed" -ge "$BENCH_MAX_ROUNDS"')
        expect(4 * 2 * 2 * 2).toBe(32)
        expect(32 + 2 * (4 * 2 * 2)).toBe(64)
    })

    test("keeps statistical verdicts advisory but parsing failures fatal", () => {
        expect(deepWorkflow).toContain("bun run scripts/bench-paired-report.ts")
        expect(deepWorkflow).not.toContain("continue-on-error: true")
        expect(deepWorkflow).not.toMatch(/outcome.*regression/)
        expect(deepWorkflow.match(/GITHUB_STEP_SUMMARY/g)).toHaveLength(1)
        expect(prWorkflow).not.toContain("bench-paired-report")
    })

    test("retains complete deep-run evidence for 90 days", () => {
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
