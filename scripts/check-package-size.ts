/**
 * Deterministic size gates for an already-packed `valdres` tarball.
 *
 * This script never builds or packs. The package contract gate passes the one
 * npm-produced tarball here so dist, packed-file, and consumer-fixture sizes
 * are all measurements of the artifact that every other validator sees.
 *
 * Ratchet the committed baseline after an intentional size change with:
 *
 *   VALDRES_UPDATE_SIZE_BASELINE=1 bun run check-size
 */
import { mkdir, mkdtemp, readdir, rename, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { isAbsolute, join, relative, resolve } from "node:path"

const TOLERANCE = 1.02
const GZIP_LEVEL = 6

const rootDir = join(import.meta.dir, "..")
const baselinePath = join(import.meta.dir, "size-baseline.json")
const updateBaseline = process.env.VALDRES_UPDATE_SIZE_BASELINE === "1"
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
        "all-exports": `export * from "valdres"`,
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
        fixtures[name] = { raw: bytes.length, gzip: gzipSize(bytes) }
    }

    const actual = { dist, distFiles, packed, fixtures }
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

    if (updateBaseline) {
        await Bun.write(baselinePath, JSON.stringify(actual, null, 4) + "\n")
        console.log(`\nBaseline written to ${relative(rootDir, baselinePath)}`)
    } else {
        await checkAgainstBaseline(dist, packed, fixtures, fixtureSources)
    }
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
            `Missing ${relative(rootDir, baselinePath)}. Generate it with:\n` +
                `  VALDRES_UPDATE_SIZE_BASELINE=1 bun run check-size`,
        )
    }
    const baseline = await baselineFile.json()
    const failures: string[] = []
    const improvements: string[] = []

    const compare = (label: string, base: Size, size: Size) => {
        for (const metric of ["raw", "gzip"] as const) {
            const expected = base[metric]
            const ceiling = Math.ceil(expected * TOLERANCE)
            const delta = size[metric] - expected
            const percent = ((delta / expected) * 100).toFixed(2)
            const detail =
                `${label} ${metric}: expected ${expected} (ceiling ${ceiling}, ` +
                `baseline + 2%), actual ${size[metric]}, delta ${
                    delta >= 0 ? "+" : ""
                }${delta} bytes (${delta >= 0 ? "+" : ""}${percent}%)`
            if (size[metric] > ceiling) failures.push(detail)
            else if (delta < 0) improvements.push(detail)
        }
    }

    compare("dist total", baseline.dist, dist)
    compare("packed package", baseline.packed, packed)
    for (const name of Object.keys(fixtureSources)) {
        const base = baseline.fixtures?.[name]
        if (!base) {
            failures.push(
                `fixture ${name}: no baseline entry — regenerate the baseline`,
            )
        } else {
            compare(`fixture ${name}`, base, fixtures[name])
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
            "\nIf the growth is intentional, regenerate the baseline with:\n" +
                "  VALDRES_UPDATE_SIZE_BASELINE=1 bun run check-size",
        )
        process.exitCode = 1
    } else {
        console.log("\nAll size gates passed")
    }
}
