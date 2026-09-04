/**
 * Deterministic size gates for an already-packed `valdres` tarball.
 *
 * This script never builds or packs. The package contract gate passes the one
 * npm-produced tarball here so dist, packed-file, and consumer-fixture sizes
 * are all measurements of the artifact that every other validator sees.
 *
 * Ordinary-control baselines are immutable. Feature budgets and the one
 * additive core gzip allowance are reviewed architecture decisions, never a
 * command-driven ratchet.
 */
import { mkdir, mkdtemp, readdir, rename, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { isAbsolute, join, relative, resolve } from "node:path"

const GZIP_LEVEL = 6
const PENDING_CERTIFICATION = "PENDING_COL008_CERTIFICATION"

const rootDir = join(import.meta.dir, "..")
const baselinePath = join(import.meta.dir, "size-baseline.json")
const tarballArgument = process.argv[2]

if (!tarballArgument) {
    throw new Error(
        "Usage: bun run scripts/check-package-size.ts <valdres.tgz>\n" +
            "Use `bun run check-size` to build and pack first.",
    )
}

const tarballPath = isAbsolute(tarballArgument)
    ? tarballArgument
    : resolve(process.cwd(), tarballArgument)

type Size = { raw: number; gzip: number }

type CertifiedSize = Size | typeof PENDING_CERTIFICATION

interface SizeBaseline {
    readonly schema: "valdres-package-size-budget"
    readonly schemaVersion: 2
    readonly toolchain: {
        readonly bun: string
        readonly gzipLevel: number
    }
    readonly provenance: {
        readonly ordinaryBaselineCommit: string
        readonly certificationBuildCount: number
        readonly certifiedRuntimeBuildSha256:
            | string
            | typeof PENDING_CERTIFICATION
    }
    readonly policy: {
        readonly ordinaryTolerancePercent: number
        readonly coreRetainingGzipAllowance:
            | number
            | typeof PENDING_CERTIFICATION
        readonly coreRetainingFixtures: readonly string[]
    }
    readonly ordinaryFixtures: Readonly<Record<string, Size>>
    readonly featureBudgets: {
        readonly dist: CertifiedSize
        readonly packed: CertifiedSize
        readonly fixtures: Readonly<Record<string, CertifiedSize>>
    }
}

const gzipSize = (bytes: Uint8Array) =>
    Bun.gzipSync(bytes, { level: GZIP_LEVEL }).length

const isPositiveSafeSize = (value: unknown): value is Size => {
    if (typeof value !== "object" || value === null) return false
    const candidate = value as Partial<Size>
    return (
        Number.isSafeInteger(candidate.raw) &&
        candidate.raw! > 0 &&
        Number.isSafeInteger(candidate.gzip) &&
        candidate.gzip! > 0
    )
}

const run = (command: string[], cwd: string) => {
    const result = Bun.spawnSync(command, {
        cwd,
        stdio: ["inherit", "pipe", "pipe"],
    })
    if (result.exitCode !== 0) {
        throw new Error(
            `\`${command.join(" ")}\` failed in ${cwd}:\n${result.stdout}${result.stderr}`,
        )
    }
}

const listFiles = async (dir: string): Promise<string[]> => {
    const entries = await readdir(dir, {
        withFileTypes: true,
        recursive: true,
    })
    return entries
        .filter(entry => entry.isFile())
        .map(entry => join(entry.parentPath, entry.name))
        .sort()
}

const tempDir = await mkdtemp(join(tmpdir(), "valdres-size-"))
try {
    run(["tar", "-xzf", tarballPath, "-C", tempDir], tempDir)
    const packedDir = join(tempDir, "package")
    const distDir = join(packedDir, "dist")
    const distJsFiles = (await listFiles(distDir)).filter(file =>
        file.endsWith(".js"),
    )
    if (distJsFiles.length === 0)
        throw new Error("no JavaScript files in dist/")

    const distFiles: Record<string, Size> = {}
    const dist: Size = { raw: 0, gzip: 0 }
    for (const file of distJsFiles) {
        const bytes = new Uint8Array(await Bun.file(file).arrayBuffer())
        const size = { raw: bytes.length, gzip: gzipSize(bytes) }
        distFiles[relative(distDir, file)] = size
        dist.raw += size.raw
        dist.gzip += size.gzip
    }

    // Compress canonical path/content framing, not tar headers, so npm and tar
    // metadata differences cannot move the committed packed-package budget.
    const packedFiles = await listFiles(packedDir)
    const packed: Size = { raw: 0, gzip: 0 }
    const framing: Uint8Array[] = []
    const encoder = new TextEncoder()
    for (const file of packedFiles) {
        const bytes = new Uint8Array(await Bun.file(file).arrayBuffer())
        packed.raw += bytes.length
        framing.push(
            encoder.encode(relative(packedDir, file)),
            new Uint8Array(1),
            bytes,
            new Uint8Array(1),
        )
    }
    const framedBytes = new Uint8Array(
        framing.reduce((total, bytes) => total + bytes.length, 0),
    )
    let frameOffset = 0
    for (const bytes of framing) {
        framedBytes.set(bytes, frameOffset)
        frameOffset += bytes.length
    }
    packed.gzip = gzipSize(framedBytes)

    const consumerDir = join(tempDir, "consumer")
    await mkdir(join(consumerDir, "node_modules"), { recursive: true })
    await rename(packedDir, join(consumerDir, "node_modules", "valdres"))

    const fixtureSources: Record<string, string> = {
        atom: `export { atom } from "valdres"`,
        "atom-selector-store": `export { atom, selector, store } from "valdres"`,
        family: `export { atom, family } from "valdres"`,
        collection: `export { collection, presence, store } from "valdres"`,
        "all-exports": `export * from "valdres"`,
        inspect: `export * from "valdres/inspect"`,
        equality: `export { deepEqual } from "valdres/equality"`,
        "adapter-internals": `export * from "valdres/adapter-internals/v1"`,
    }
    const fixtures: Record<string, Size> = {}
    for (const [name, source] of Object.entries(fixtureSources)) {
        const entry = join(consumerDir, `${name}.ts`)
        await Bun.write(entry, source)
        const result = await Bun.build({
            entrypoints: [entry],
            minify: true,
            define: { "process.env.NODE_ENV": JSON.stringify("production") },
        })
        if (!result.success) {
            throw new Error(
                `fixture "${name}" failed to bundle:\n${result.logs.join("\n")}`,
            )
        }
        const bytes = new Uint8Array(
            await new Blob(
                await Promise.all(
                    result.outputs.map(output => output.arrayBuffer()),
                ),
            ).arrayBuffer(),
        )
        if (name === "atom") {
            const JavaScript = new TextDecoder().decode(bytes)
            for (const optionalFeatureSentinel of [
                "family cannot recursively construct the same member",
                "family members require at least one key",
                "family keys must be primitive; use encodeKey for structured arguments",
                "collection options must be an object",
                "collection indexes are not available in this beta",
                "Cannot update an absent collection row",
            ]) {
                if (JavaScript.includes(optionalFeatureSentinel)) {
                    throw new Error(
                        `atom-only fixture retained optional feature implementation: ${optionalFeatureSentinel}`,
                    )
                }
            }
        }
        fixtures[name] = { raw: bytes.length, gzip: gzipSize(bytes) }
    }

    const lines = [
        "Measured sizes (bytes):",
        `  dist total          raw ${dist.raw}  gzip ${dist.gzip}`,
        ...Object.entries(distFiles).map(
            ([file, size]) =>
                `    ${file.padEnd(24)} raw ${size.raw}  gzip ${size.gzip}`,
        ),
        `  packed package      raw ${packed.raw}  gzip ${packed.gzip}`,
        ...Object.entries(fixtures).map(
            ([name, size]) =>
                `  fixture ${name.padEnd(19)} raw ${size.raw}  gzip ${size.gzip}`,
        ),
    ]
    console.log(lines.join("\n"))
    await checkAgainstBaseline(dist, packed, fixtures, fixtureSources)
} finally {
    await rm(tempDir, { recursive: true, force: true })
}

async function checkAgainstBaseline(
    dist: Size,
    packed: Size,
    fixtures: Record<string, Size>,
    fixtureSources: Record<string, string>,
) {
    const baselineFile = Bun.file(baselinePath)
    if (!(await baselineFile.exists())) {
        throw new Error(
            `Missing immutable size budget ${relative(rootDir, baselinePath)}`,
        )
    }
    const baseline = (await baselineFile.json()) as SizeBaseline
    const failures: string[] = []

    if (
        baseline.schema !== "valdres-package-size-budget" ||
        baseline.schemaVersion !== 2
    ) {
        failures.push(
            "size budget must use valdres-package-size-budget schema version 2",
        )
    }
    if (baseline.toolchain?.bun !== Bun.version) {
        failures.push(
            `size certification requires Bun ${baseline.toolchain?.bun}; running ${Bun.version}`,
        )
    }
    if (baseline.toolchain?.gzipLevel !== GZIP_LEVEL) {
        failures.push(
            `size budget gzip level must remain ${GZIP_LEVEL}; received ${baseline.toolchain?.gzipLevel}`,
        )
    }

    const allowance = baseline.policy?.coreRetainingGzipAllowance
    if (allowance === PENDING_CERTIFICATION) {
        failures.push("core-retaining gzip allowance is not certified")
    } else if (
        typeof allowance !== "number" ||
        !Number.isInteger(allowance) ||
        allowance < 0
    ) {
        failures.push(
            "core-retaining gzip allowance must be a nonnegative integer",
        )
    }

    const tolerance = baseline.policy?.ordinaryTolerancePercent
    if (tolerance !== 2) {
        failures.push(
            `ordinary tolerance must remain exactly 2%; received ${tolerance}`,
        )
    }
    const ordinaryTolerance = tolerance === 2 ? tolerance : 2
    const coreRetaining = new Set(baseline.policy?.coreRetainingFixtures ?? [])

    const compareOrdinary = (label: string, base: Size, size: Size) => {
        if (!isPositiveSafeSize(base)) {
            failures.push(
                `ordinary fixture ${label}: immutable raw/gzip baseline must contain positive safe integers`,
            )
            return
        }
        for (const metric of ["raw", "gzip"] as const) {
            const toleranceCeiling = Math.ceil(
                (base[metric] * (100 + ordinaryTolerance)) / 100,
            )
            const additive =
                metric === "gzip" &&
                coreRetaining.has(label) &&
                typeof allowance === "number"
                    ? allowance
                    : 0
            const ceiling = toleranceCeiling + additive
            const delta = size[metric] - base[metric]
            const percent = ((delta / base[metric]) * 100).toFixed(2)
            if (size[metric] > ceiling) {
                failures.push(
                    `ordinary fixture ${label} ${metric}: immutable baseline ${base[metric]}, ` +
                        `2% ceiling ${toleranceCeiling}, additive allowance ${additive}, ` +
                        `actual ${size[metric]}, delta ${delta >= 0 ? "+" : ""}${delta} ` +
                        `bytes (${delta >= 0 ? "+" : ""}${percent}%)`,
                )
            }
        }
    }

    const compareFeature = (
        label: string,
        budget: CertifiedSize | undefined,
        size: Size,
    ) => {
        if (budget === PENDING_CERTIFICATION || budget === undefined) {
            failures.push(`${label}: feature budget is not certified`)
            return
        }
        if (!isPositiveSafeSize(budget)) {
            failures.push(
                `${label}: certified raw/gzip budget must contain positive safe integers`,
            )
            return
        }
        for (const metric of ["raw", "gzip"] as const) {
            if (size[metric] > budget[metric]) {
                failures.push(
                    `${label} ${metric}: reviewed budget ${budget[metric]}, actual ${size[metric]}, ` +
                        `over by ${size[metric] - budget[metric]} bytes`,
                )
            }
        }
    }

    const ordinaryNames = Object.keys(baseline.ordinaryFixtures ?? {})
    for (const name of ordinaryNames) {
        if (!(name in fixtureSources)) {
            failures.push(`ordinary fixture ${name}: source is missing`)
            continue
        }
        compareOrdinary(name, baseline.ordinaryFixtures[name]!, fixtures[name]!)
    }
    if (
        !Array.isArray(baseline.policy?.coreRetainingFixtures) ||
        coreRetaining.size !== baseline.policy.coreRetainingFixtures.length
    ) {
        failures.push(
            "core-retaining fixtures must be a duplicate-free ordinary-fixture subset",
        )
    }
    for (const name of coreRetaining) {
        if (!ordinaryNames.includes(name)) {
            failures.push(
                `core-retaining fixture ${name}: immutable ordinary baseline is missing`,
            )
        }
    }

    compareFeature("dist total", baseline.featureBudgets?.dist, dist)
    compareFeature("packed package", baseline.featureBudgets?.packed, packed)
    const featureFixtureNames = new Set(
        Object.keys(baseline.featureBudgets?.fixtures ?? {}),
    )
    for (const name of featureFixtureNames) {
        if (ordinaryNames.includes(name)) {
            failures.push(
                `fixture ${name}: feature and ordinary fixture names must be disjoint`,
            )
        }
    }
    for (const name of Object.keys(fixtureSources)) {
        const ordinary = ordinaryNames.includes(name)
        const feature = featureFixtureNames.has(name)
        if (ordinary === feature) {
            failures.push(
                `fixture ${name}: must belong to exactly one ordinary or feature budget class`,
            )
            continue
        }
        if (feature) {
            compareFeature(
                `feature fixture ${name}`,
                baseline.featureBudgets.fixtures[name],
                fixtures[name]!,
            )
        }
    }
    for (const name of featureFixtureNames) {
        if (!(name in fixtureSources)) {
            failures.push(`feature fixture ${name}: source is missing`)
        }
    }

    if (
        baseline.provenance?.certifiedRuntimeBuildSha256 ===
        PENDING_CERTIFICATION
    ) {
        failures.push("runtime build digest is not certified")
    } else if (
        !/^[0-9a-f]{64}$/.test(
            baseline.provenance?.certifiedRuntimeBuildSha256 ?? "",
        )
    ) {
        failures.push("runtime build digest must be a lowercase SHA-256")
    }
    if (baseline.provenance?.certificationBuildCount !== 3) {
        failures.push("size certification must record exactly three builds")
    }

    if (failures.length > 0) {
        console.error(`\n${failures.length} size gate(s) failed:`)
        for (const line of failures) console.error(`  ✗ ${line}`)
        console.error(
            "\nOrdinary baselines cannot be regenerated. Intentional growth requires " +
                "an explicit architecture review and a reviewed budget-policy edit.",
        )
        process.exitCode = 1
    } else {
        console.log(
            "\nAll immutable ordinary and reviewed feature size gates passed",
        )
    }
}
