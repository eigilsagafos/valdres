import { describe, expect, test } from "bun:test"
import { spawnSync } from "child_process"
import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    rmSync,
    writeFileSync,
} from "fs"
import { tmpdir } from "os"
import { join } from "path"

// `.bun-version` is the single source of truth for which Bun this repo is built
// and measured with. It is not decorative: bundler output is toolchain-specific,
// so a Bun mismatch silently invalidates the published-package SIZE GATE.
//
// This bit us once. `scripts/size-baseline.json` had been regenerated on a
// developer's local Bun 1.3.13 while CI enforced it on the pinned 1.4.0, which
// emits ~2.2KB more for identical source — more than the gate's whole 2%
// allowance. `main` passed with 16 bytes of headroom for several releases, so
// any PR adding more than that failed regardless of merit, while
// `bun run check-size` locally reported all gates passing on the very commit CI
// rejected. See .context/nagoya/ARCHITECTURE-REVIEW.md (finding 5).
//
// So the version lives in one file and everything that depends on it is
// asserted against that file here. Bumping Bun is then a deliberate act with a
// visible checklist: update `.bun-version`, update the workflow pins, and run a
// new architecture review. Immutable ordinary size baselines are never
// regenerated as part of that process.

const rootDir = join(import.meta.dir, "..")
const read = (path: string) => readFileSync(join(rootDir, path), "utf8")

const pinnedVersion = read(".bun-version").trim()
const ordinaryBaselineCommit = "15d535c7ec80b50fd31e44129a42232cbab19609"
const immutableOrdinaryFixtures = {
    atom: { raw: 64797, gzip: 16861 },
    "atom-selector-store": { raw: 64984, gzip: 16930 },
    family: { raw: 71064, gzip: 18990 },
    equality: { raw: 7231, gzip: 2210 },
    "adapter-internals": { raw: 64767, gzip: 16835 },
}

const expectExactKeys = (value: unknown, expected: readonly string[]): void => {
    expect(value).not.toBeNull()
    expect(typeof value).toBe("object")
    expect(Object.keys(value as object).sort()).toEqual([...expected].sort())
}

const pendingPaths = (value: unknown, path = "$."): string[] => {
    if (typeof value === "string")
        return value.includes("PENDING") ? [path] : []
    if (value === null || typeof value !== "object") return []
    return Object.entries(value).flatMap(([key, child]) =>
        pendingPaths(child, `${path}${key}.`),
    )
}

/** YAML scalars may be quoted; `bun-version: "1.4.0"` and `bun-version: 1.4.0`
 *  are the same value to the action, so they must be the same value here.
 *  Comparing the raw capture treated a legitimately quoted pin as a mismatch. */
const unquote = (value: string) =>
    value.replace(/^(['"])(.*)\1$/, (_match, _quote, inner) => inner)

/** The repository-root version file, written the ways YAML might spell it.
 *  A suffix test is not enough: `config/.bun-version` and `evil.bun-version`
 *  both end in `.bun-version` while being a different source of truth. */
const ROOT_VERSION_FILE = new Set([".bun-version", "./.bun-version"])

const compareSemver = (a: string, b: string) => {
    const parse = (v: string) =>
        v
            .replace(/^v/, "")
            .split(".")
            .map(part => Number.parseInt(part, 10))
    const [aParts, bParts] = [parse(a), parse(b)]
    for (let i = 0; i < 3; i++) {
        const diff = (aParts[i] ?? 0) - (bParts[i] ?? 0)
        if (diff !== 0) return diff
    }
    return 0
}

describe("pinned Bun toolchain", () => {
    test(".bun-version is a bare semver with no v prefix or range", () => {
        // setup-bun and the version managers that read this file want an exact
        // version. A range here would defeat the point of pinning.
        expect(pinnedVersion).toMatch(/^\d+\.\d+\.\d+$/)
    })

    // Enumerate SETUP STEPS, not pins. Scanning for `bun-version:` keys can
    // only check the pins that still exist: drop the key from one workflow and
    // the remaining pins keep the guard green while that job silently installs
    // whatever Bun is latest — the original failure mode, reintroduced.
    // `oven-sh/setup-bun` does not auto-detect `.bun-version` (its
    // `bun-version-file` input defaults to null), so a step with neither input
    // resolves to latest and must fail here. (Caught by Copilot on PR #329.)
    const setupBunSteps = () => {
        const workflowDir = join(rootDir, ".github/workflows")
        const steps: Array<{
            file: string
            line: number
            key?: string
            value?: string
        }> = []
        for (const file of readdirSync(workflowDir)) {
            if (!file.endsWith(".yml") && !file.endsWith(".yaml")) continue
            const lines = read(`.github/workflows/${file}`).split("\n")
            lines.forEach((line, index) => {
                if (!/uses:\s*oven-sh\/setup-bun/.test(line)) return
                // Sibling keys of `uses:` align with it; anything less indented
                // starts the next step or block, which ends this one.
                const stepIndent = line.indexOf("uses:")
                let key: string | undefined
                let value: string | undefined
                for (let next = index + 1; next < lines.length; next++) {
                    const candidate = lines[next]!
                    if (candidate.trim() === "") continue
                    const indent =
                        candidate.length - candidate.trimStart().length
                    if (indent < stepIndent) break
                    const match = candidate.match(
                        /^\s*(bun-version|bun-version-file):\s*(\S+)\s*$/,
                    )
                    if (match) {
                        key = match[1]
                        value = match[2]
                        break
                    }
                }
                steps.push({ file, line: index + 1, key, value })
            })
        }
        return steps
    }

    test("every setup-bun step declares a Bun version", () => {
        const steps = setupBunSteps()
        // Guard the guard: if the scan stops finding steps at all (e.g. the
        // action is renamed), fail rather than silently assert nothing.
        expect(steps.length).toBeGreaterThan(0)
        const unpinned = steps.filter(step => step.key === undefined)
        expect(unpinned.map(step => `${step.file}:${step.line}`)).toEqual([])
    })

    test("every setup-bun step resolves to the pinned Bun", () => {
        const mismatched = setupBunSteps().filter(step => {
            const value = unquote(step.value ?? "")
            if (step.key === "bun-version") return value !== pinnedVersion
            // Reading the version from a file is fine as long as it is THIS
            // file — compared as a whole path, not by suffix, so a second
            // version file elsewhere in the tree cannot quietly take over.
            if (step.key === "bun-version-file")
                return !ROOT_VERSION_FILE.has(value)
            return false // absence is the other test's business
        })
        expect(
            mismatched.map(
                step =>
                    `${step.file}:${step.line} → ${step.key}: ${step.value}`,
            ),
        ).toEqual([])
    })

    test("the immutable size policy is pinned to the certified toolchain", () => {
        const baseline = JSON.parse(read("scripts/size-baseline.json"))
        expect(pendingPaths(baseline)).toEqual([])
        expectExactKeys(baseline, [
            "schema",
            "schemaVersion",
            "toolchain",
            "provenance",
            "policy",
            "ordinaryFixtures",
            "featureBudgets",
        ])
        expectExactKeys(baseline.toolchain, ["bun", "gzipLevel"])
        expectExactKeys(baseline.provenance, [
            "ordinaryBaselineCommit",
            "certificationBuildCount",
            "certifiedRuntimeBuildSha256",
        ])
        expectExactKeys(baseline.policy, [
            "ordinaryTolerancePercent",
            "coreRetainingGzipAllowance",
            "coreRetainingFixtures",
        ])
        expectExactKeys(baseline.featureBudgets, ["dist", "packed", "fixtures"])
        expect(baseline.schema).toBe("valdres-package-size-budget")
        expect(baseline.schemaVersion).toBe(2)
        expect(baseline.toolchain).toEqual({ bun: pinnedVersion, gzipLevel: 6 })
        expect(baseline.provenance.ordinaryBaselineCommit).toBe(
            ordinaryBaselineCommit,
        )
        expect(baseline.provenance.certificationBuildCount).toBe(3)
        expect(baseline.policy.ordinaryTolerancePercent).toBe(2)
        expect(baseline.ordinaryFixtures).toEqual(immutableOrdinaryFixtures)
        expect(baseline.policy.coreRetainingFixtures).toEqual([
            "atom",
            "atom-selector-store",
            "family",
            "adapter-internals",
        ])
        const ordinaryFixtureNames = Object.keys(
            baseline.ordinaryFixtures,
        ).sort()
        const featureFixtureNames = Object.keys(
            baseline.featureBudgets.fixtures,
        ).sort()
        expect(featureFixtureNames).toEqual([
            "all-exports",
            "collection",
            "inspect",
        ])
        expect(
            baseline.policy.coreRetainingFixtures.every((name: string) =>
                ordinaryFixtureNames.includes(name),
            ),
        ).toBe(true)
        expect(
            featureFixtureNames.filter(name =>
                ordinaryFixtureNames.includes(name),
            ),
        ).toEqual([])

        const digest = baseline.provenance.certifiedRuntimeBuildSha256
        expect(digest).toMatch(/^[0-9a-f]{64}$/)
        const allowance = baseline.policy.coreRetainingGzipAllowance
        expect(allowance).toBe(62)
        for (const budget of [
            baseline.featureBudgets.dist,
            baseline.featureBudgets.packed,
            ...Object.values(baseline.featureBudgets.fixtures),
        ]) {
            expect(
                Number.isSafeInteger((budget as { raw?: number }).raw) &&
                    (budget as { raw: number }).raw > 0 &&
                    Number.isSafeInteger((budget as { gzip?: number }).gzip) &&
                    (budget as { gzip: number }).gzip > 0,
            ).toBe(true)
        }
    })

    test("the collection performance certificate is deterministic-first and complete", () => {
        const certification = JSON.parse(
            read(
                "packages/valdres/test/performance/collection-performance-certification.json",
            ),
        )
        const packageManifest = JSON.parse(
            read("packages/valdres/package.json"),
        )
        const scripts = packageManifest.scripts as Record<string, string>
        expect(pendingPaths(certification)).toEqual([])
        expectExactKeys(certification, [
            "schemaVersion",
            "kind",
            "cwd",
            "toolchain",
            "policy",
            "cardinalities",
            "deterministic",
            "timingSmoke",
            "lifecycle",
        ])
        expect(certification.schemaVersion).toBe(2)
        expect(certification.kind).toBe("valdres-collection-performance-policy")
        expect(certification.cwd).toBe("packages/valdres")
        expect(certification.toolchain).toEqual({
            runtime: "bun",
            version: pinnedVersion,
        })
        expectExactKeys(certification.policy, [
            "primaryGate",
            "timingRole",
            "processCount",
            "rounds",
            "warmupBatches",
            "directIterationsPerBatch",
            "transactionIterationsPerBatch",
            "advisoryTargetRatio",
            "catastrophicRatio",
            "decisionMetric",
        ])
        expect(certification.policy).toEqual({
            primaryGate: "deterministic-structural",
            timingRole: "advisory-smoke",
            processCount: 1,
            rounds: 8,
            warmupBatches: 4,
            directIterationsPerBatch: 40_000,
            transactionIterationsPerBatch: 20_000,
            advisoryTargetRatio: 1.1,
            catastrophicRatio: 1.5,
            decisionMetric: "geometric-median-wall-ratio",
        })
        expect(certification.policy.processCount).toBeGreaterThan(0)
        expect(certification.policy.rounds).toBeGreaterThan(0)
        expect(certification.policy.warmupBatches).toBeGreaterThan(0)
        expect(certification.policy.directIterationsPerBatch).toBeGreaterThan(0)
        expect(
            certification.policy.transactionIterationsPerBatch,
        ).toBeGreaterThan(0)
        expect(certification.policy.advisoryTargetRatio).toBeGreaterThan(1)
        expect(certification.policy.catastrophicRatio).toBeGreaterThan(
            certification.policy.advisoryTargetRatio,
        )
        expectExactKeys(certification.cardinalities, [
            "membership",
            "siblingFanout",
            "inheritanceDepth",
        ])
        expect(certification.cardinalities).toEqual({
            membership: [1_000, 5_000, 20_000],
            siblingFanout: 20_000,
            inheritanceDepth: 1_024,
        })
        expectExactKeys(certification.deterministic, [
            "command",
            "normalCiCommand",
            "testPath",
            "claims",
        ])
        expect(certification.deterministic).toMatchObject({
            command: "bun run test:collection:performance",
            normalCiCommand: "bun run test:runtime",
            testPath: "test/performance/collection.performance.test.ts",
        })
        expectExactKeys(certification.deterministic.claims, [
            "collectionCountersZero",
            "atomVtableRebuildTraceEmpty",
            "atomVtablePlacementZero",
            "exactMembershipWorkAtScale",
            "presentUpdateMembershipWorkZero",
            "absentReadMembershipWorkZero",
            "inspectionDetailAttemptsConstant",
            "siblingRouteVisitsZero",
            "depthPlacementLinear",
        ])
        expect(
            Object.values(certification.deterministic.claims).every(
                value => value === true,
            ),
        ).toBe(true)
        expectExactKeys(certification.timingSmoke, [
            "command",
            "testPath",
            "scenarios",
            "pairing",
            "wallClock",
            "cpuDiagnostic",
            "persistsResults",
        ])
        expect(certification.timingSmoke).toEqual({
            command: "bun run test:collection:timing",
            testPath: "test/performance/collection.timing.ts",
            scenarios: ["atom-direct", "atom-transaction"],
            pairing: "adjacent-ab-ba",
            wallClock: "Bun.nanoseconds",
            cpuDiagnostic: "process.cpuUsage",
            persistsResults: false,
        })
        expectExactKeys(certification.lifecycle, ["command", "testPath"])
        expect(certification.lifecycle).toEqual({
            command: "bun run test:collection:memory:bun",
            testPath: "test/performance/collection.memory.ts",
        })

        expect(scripts["test:runtime"]).toContain(
            certification.deterministic.testPath,
        )
        expect(scripts["test:runtime"]).not.toContain(
            certification.timingSmoke.testPath,
        )
        expect(scripts["test:ci"]).toContain("bun run test:runtime")
        expect(scripts["test:collection:performance"]).toBe(
            `NODE_ENV=production bun test --timeout 120000 --concurrency 1 ./${certification.deterministic.testPath}`,
        )
        expect(scripts["test:collection:timing"]).toBe(
            `NODE_ENV=production bun ./${certification.timingSmoke.testPath}`,
        )
        expect(scripts["test:collection:memory:bun"]).toBe(
            `NODE_ENV=production bun test --timeout 120000 --concurrency 1 ./${certification.lifecycle.testPath}`,
        )
    })

    test("the package-size checker exposes no baseline-update escape hatch", () => {
        const checker = read("scripts/check-package-size.ts")
        expect(checker).not.toContain("VALDRES_UPDATE_SIZE_BASELINE")
        expect(checker).not.toContain("updateBaseline")
        expect(checker).not.toContain("regenerate the baseline")
    })

    test("the pinned Bun satisfies the engines floor in package.json", () => {
        const { engines } = JSON.parse(read("package.json"))
        const floor = engines?.bun?.match(/\d+\.\d+\.\d+/)?.[0]
        expect(floor).toBeDefined()
        expect(compareSemver(pinnedVersion, floor!)).toBeGreaterThanOrEqual(0)
    })
})

const publishValidationSource = () => {
    const script = read("scripts/ci-publish.sh")
    const match = script.match(/node - .*?<<'NODE'\n([\s\S]*?)\nNODE/)
    expect(match).not.toBeNull()
    return match![1]!
}

interface ReleaseFixture {
    readonly mode?: string
    readonly tag?: string
    readonly coreName?: string
    readonly coreVersion?: unknown
    readonly reactName?: string
    readonly reactVersion?: unknown
    readonly reactCorePeer?: string
}

const validateReleaseFixture = (fixture: ReleaseFixture) => {
    const directory = mkdtempSync(join(tmpdir(), "valdres-release-policy-"))
    const coreDirectory = join(directory, "packages", "valdres")
    const reactDirectory = join(directory, "packages", "valdres-react")

    try {
        mkdirSync(join(directory, ".changeset"), { recursive: true })
        mkdirSync(coreDirectory, { recursive: true })
        mkdirSync(reactDirectory, { recursive: true })
        writeFileSync(
            join(directory, ".changeset", "pre.json"),
            JSON.stringify({
                mode: fixture.mode ?? "pre",
                tag: fixture.tag ?? "beta",
            }),
        )
        writeFileSync(
            join(coreDirectory, "package.json"),
            JSON.stringify({
                name: fixture.coreName ?? "valdres",
                version: fixture.coreVersion,
            }),
        )
        writeFileSync(
            join(reactDirectory, "package.json"),
            JSON.stringify({
                name: fixture.reactName ?? "valdres-react",
                version: fixture.reactVersion,
                peerDependencies: {
                    valdres: fixture.reactCorePeer ?? "^1.0.0-beta.27",
                },
            }),
        )

        return spawnSync(
            "node",
            ["-", directory, "packages/valdres", "packages/valdres-react"],
            {
                encoding: "utf8",
                input: publishValidationSource(),
            },
        )
    } finally {
        rmSync(directory, { recursive: true, force: true })
    }
}

describe("release versions follow checked-in manifests", () => {
    test("accepts any canonical beta counter without editing release scripts", () => {
        const result = validateReleaseFixture({
            coreVersion: "2.3.4-beta.912",
            reactVersion: "0.8.0-beta.37",
        })

        expect(result.status).toBe(0)
    })

    test("release tooling contains no manually scheduled beta counter", () => {
        const publish = read("scripts/ci-publish.sh")
        const packedConsumer = read("scripts/test-v1-beta-packed-consumer.ts")

        expect(publish).not.toContain("expectedVersions")
        expect(publish).not.toContain("predecessorVersions")
        expect(publish).not.toMatch(/\d+\.\d+\.\d+-beta\.\d+/)
        expect(packedConsumer).not.toContain("VALDRES_PACKED_CORE_BETA_VERSION")
        expect(packedConsumer).not.toContain(
            "VALDRES_PACKED_REACT_BETA_VERSION",
        )
        expect(packedConsumer).not.toContain("VALDRES_PACKED_REACT_CORE_PEER")
        expect(packedConsumer).not.toContain("manifest.version =")
        expect(packedConsumer).not.toMatch(/\d+\.\d+\.\d+-beta\.\d+/)
    })

    test("still rejects a version outside the beta release channel", () => {
        const invalidFixtures: readonly ReleaseFixture[] = [
            {
                coreVersion: "1.0.0",
                reactVersion: "1.0.0-beta.6",
            },
            {
                tag: "rc",
                coreVersion: "1.0.0-rc.1",
                reactVersion: "1.0.0-rc.1",
            },
            {
                coreVersion: "1.0.0-beta.01",
                reactVersion: "1.0.0-beta.6",
            },
            {
                mode: "exit",
                coreVersion: "1.0.0-beta.29",
                reactVersion: "1.0.0-beta.6",
            },
            {
                coreName: "not-valdres",
                coreVersion: "1.0.0-beta.29",
                reactVersion: "1.0.0-beta.6",
            },
            {
                coreVersion: "1.0.0-beta.29",
                reactName: "not-valdres-react",
                reactVersion: "1.0.0-beta.6",
            },
            {
                coreVersion: undefined,
                reactVersion: "1.0.0-beta.6",
            },
            {
                coreVersion: "1.0.0-beta.29",
                reactVersion: 6,
            },
        ]

        for (const fixture of invalidFixtures) {
            expect(validateReleaseFixture(fixture).status).not.toBe(0)
        }
    })
})
