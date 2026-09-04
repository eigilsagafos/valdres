/**
 * Deterministic size gates for an already-packed `valdres` tarball.
 *
 * This script never builds or packs. The package contract gate passes the one
 * npm-produced tarball here so dist, packed-file, and consumer-fixture sizes
 * are all measurements of the artifact that every other validator sees.
 *
 * Pre-collection baselines stay immutable. The collection stack carries a
 * reviewed feature envelope plus a temporary ordinary-fixture gzip seam until
 * COL-008 replaces it with the final certified policy.
 */
import { mkdir, mkdtemp, readdir, rename, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { isAbsolute, join, relative, resolve } from "node:path"

const TOLERANCE = 1.02
const GZIP_LEVEL = 6

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

const gzipSize = (bytes: Uint8Array) =>
    Bun.gzipSync(bytes, { level: GZIP_LEVEL }).length

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
        throw new Error(`Missing ${relative(rootDir, baselinePath)}`)
    }
    const baseline = await baselineFile.json()
    const failures: string[] = []
    const improvements: string[] = []
    const policy = baseline.policy as
        | {
              ordinaryTolerancePercent?: number
              coreRetainingGzipAllowance?: number
              coreRetainingFixtures?: string[]
          }
        | undefined
    const featureBudgets = baseline.featureBudgets as
        | {
              dist?: Size
              packed?: Size
              fixtures?: Record<string, Size>
          }
        | undefined
    const allowance = policy?.coreRetainingGzipAllowance
    const coreRetaining = new Set<string>(
        policy?.coreRetainingFixtures ?? [],
    )

    if (baseline.bun !== Bun.version) {
        failures.push(
            `size policy requires Bun ${baseline.bun}; running ${Bun.version}`,
        )
    }
    if (policy?.ordinaryTolerancePercent !== 2) {
        failures.push("ordinary size tolerance must remain exactly 2%")
    }
    if (!Number.isSafeInteger(allowance) || allowance !== 71) {
        failures.push("provisional collection gzip seam must remain 71 bytes")
    }

    const compareOrdinary = (label: string, base: Size, size: Size) => {
        for (const metric of ["raw", "gzip"] as const) {
            const expected = base[metric]
            const additive =
                metric === "gzip" && coreRetaining.has(label)
                    ? (allowance ?? 0)
                    : 0
            const ceiling = Math.ceil(expected * TOLERANCE) + additive
            const delta = size[metric] - expected
            const percent = ((delta / expected) * 100).toFixed(2)
            const detail =
                `${label} ${metric}: expected ${expected} (ceiling ${ceiling}, ` +
                `immutable baseline + 2%${additive === 0 ? "" : ` + ${additive}`}), actual ${size[metric]}, delta ${
                    delta >= 0 ? "+" : ""
                }${delta} bytes (${delta >= 0 ? "+" : ""}${percent}%)`
            if (size[metric] > ceiling) failures.push(detail)
            else if (delta < 0) improvements.push(detail)
        }
    }

    const compareFeature = (
        label: string,
        budget: Size | undefined,
        size: Size,
    ) => {
        if (
            budget === undefined ||
            !Number.isSafeInteger(budget.raw) ||
            budget.raw <= 0 ||
            !Number.isSafeInteger(budget.gzip) ||
            budget.gzip <= 0
        ) {
            failures.push(`${label}: reviewed feature budget is missing`)
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

    compareFeature("dist total", featureBudgets?.dist, dist)
    compareFeature("packed package", featureBudgets?.packed, packed)
    for (const name of Object.keys(fixtureSources)) {
        const featureBudget = featureBudgets?.fixtures?.[name]
        if (featureBudget !== undefined) {
            compareFeature(`feature fixture ${name}`, featureBudget, fixtures[name])
            continue
        }
        const base = baseline.fixtures?.[name]
        if (!base) {
            failures.push(`fixture ${name}: no immutable baseline entry`)
        } else {
            compareOrdinary(`fixture ${name}`, base, fixtures[name])
        }
    }

    if (improvements.length > 0) {
        console.log("\nSize improvements (ratchet the baseline to lock in):")
        for (const line of improvements) console.log(`  ↓ ${line}`)
    }
    if (failures.length > 0) {
        console.error(`\n${failures.length} size gate(s) exceeded:`)
        for (const line of failures) console.error(`  ✗ ${line}`)
        console.error(
            "\nOrdinary baselines cannot be regenerated. Intentional growth requires " +
                "an explicit architecture review and a reviewed policy edit.",
        )
        process.exitCode = 1
    } else {
        console.log("\nAll size gates passed")
    }
}
