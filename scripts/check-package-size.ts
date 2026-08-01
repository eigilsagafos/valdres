/**
 * Deterministic package and consumer bundle-size gates for `valdres`.
 *
 * Measures three distinct artifacts and gates each against a committed
 * baseline (scripts/size-baseline.json) with a +2% ceiling:
 *
 *   1. dist     — every JavaScript file in the complete published dist output
 *                 (fresh `bun run build`), raw bytes + deterministic gzip.
 *   2. packed   — the full packed file set after build → build:types → prepack
 *                 (the files `npm pack` puts in the tarball, including the
 *                 prepacked package.json), raw bytes + deterministic gzip.
 *   3. fixtures — minified consumer bundles built from the prepacked package
 *                 resolved through its published `exports`: atom only,
 *                 atom + selector + store, all public exports, and the
 *                 adapter-internals entrypoint.
 *
 * All compression is `Bun.gzipSync` at a fixed level — implemented in code so
 * results carry no shell-gzip metadata (mtime, filename) and are reproducible
 * across machines. The packed measure gzips a canonical framing of the sorted
 * file set rather than the tarball itself, so npm/tar version differences in
 * archive metadata cannot move the number.
 *
 * Regenerate the baseline (initial capture, or ratcheting down after an
 * improvement) with:
 *
 *   VALDRES_UPDATE_SIZE_BASELINE=1 bun run check-size
 *
 * Ceilings are computed from the stored exact values, so ratcheting the
 * baseline tightens the gate automatically. Per-file dist sizes are recorded
 * in the baseline for context only — split chunks carry content hashes in
 * their names, so the gates apply to the dist totals, the packed set, and
 * each fixture.
 */
import { mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, relative } from "node:path"

const TOLERANCE = 1.02
const GZIP_LEVEL = 6

const rootDir = join(import.meta.dir, "..")
const pkgDir = join(rootDir, "packages/valdres")
const baselinePath = join(import.meta.dir, "size-baseline.json")
const updateBaseline = process.env.VALDRES_UPDATE_SIZE_BASELINE === "1"

type Size = { raw: number; gzip: number }

const gzipSize = (bytes: Uint8Array) =>
    Bun.gzipSync(bytes, { level: GZIP_LEVEL }).length

const run = (cmd: string[], cwd: string) => {
    const result = Bun.spawnSync(cmd, {
        cwd,
        stdio: ["inherit", "pipe", "pipe"],
    })
    if (result.exitCode !== 0) {
        throw new Error(
            `\`${cmd.join(" ")}\` failed in ${cwd}:\n${result.stdout}${result.stderr}`,
        )
    }
    return result.stdout.toString()
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

// ── 1. dist: every JavaScript file in the complete published dist output ────

console.log("Building valdres (dist + types)...")
run(["bun", "run", "build"], pkgDir)
run(["bun", "run", "build:types"], pkgDir)

const distDir = join(pkgDir, "dist")
const distJsFiles = (await listFiles(distDir)).filter(f => f.endsWith(".js"))
if (distJsFiles.length === 0) throw new Error("no JavaScript files in dist/")

const distFiles: Record<string, Size> = {}
const dist: Size = { raw: 0, gzip: 0 }
for (const file of distJsFiles) {
    const bytes = new Uint8Array(await Bun.file(file).arrayBuffer())
    const size = { raw: bytes.length, gzip: gzipSize(bytes) }
    distFiles[relative(distDir, file)] = size
    dist.raw += size.raw
    dist.gzip += size.gzip
}

// ── 2. packed: the packed package after build, types, and prepack ────────────

console.log("Prepacking and packing...")
const pkgJsonPath = join(pkgDir, "package.json")
const originalPackageJson = await Bun.file(pkgJsonPath).text()
const tmpDir = await mkdtemp(join(tmpdir(), "valdres-size-"))
// Everything below runs inside this one try/finally so the temporary
// directory is removed on every path — success, gate failure, baseline
// update, and errors thrown during prepack/pack itself. Exit status is set
// via process.exitCode, never process.exit(), which would skip the finally.
try {
    let tarballPath: string
    try {
        run(["bun", "run", join(import.meta.dir, "prepack.ts")], pkgDir)
        const packJson = run(
            [
                "npm",
                "pack",
                "--ignore-scripts",
                "--json",
                "--pack-destination",
                tmpDir,
            ],
            pkgDir,
        )
        tarballPath = join(tmpDir, JSON.parse(packJson)[0].filename)
    } finally {
        // Restore the pre-prepack package.json even if packing failed.
        await Bun.write(pkgJsonPath, originalPackageJson)
        await rm(join(pkgDir, "package.tmp.json"), { force: true })
    }

    run(["tar", "-xzf", tarballPath, "-C", tmpDir], tmpDir)
    const packedDir = join(tmpDir, "package")
    const packedFiles = await listFiles(packedDir)

    // Raw = total unpacked bytes. Gzip = deterministic compression of a
    // canonical framing (sorted `path\0content\0`), so the measure depends only
    // on the packed file set — never on tar headers or npm's gzip settings.
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
    packed.gzip = gzipSize(
        new Uint8Array(await new Blob(framing).arrayBuffer()),
    )

    // ── 3. minified consumer fixtures from the prepacked package ─────────────

    console.log("Building consumer fixtures...")
    const consumerDir = join(tmpDir, "consumer")
    run(["mkdir", "-p", join(consumerDir, "node_modules")], tmpDir)
    run(["mv", packedDir, join(consumerDir, "node_modules", "valdres")], tmpDir)

    const FIXTURES: Record<string, string> = {
        atom: `export { atom } from "valdres"`,
        "atom-selector-store": `export { atom, selector, store } from "valdres"`,
        "all-exports": `export * from "valdres"`,
        "adapter-internals": `export * from "valdres/adapter-internals/v1"`,
    }

    const fixtures: Record<string, Size> = {}
    for (const [name, source] of Object.entries(FIXTURES)) {
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
                await Promise.all(result.outputs.map(o => o.arrayBuffer())),
            ).arrayBuffer(),
        )
        fixtures[name] = { raw: bytes.length, gzip: gzipSize(bytes) }
    }

    // ── Compare against the baseline ─────────────────────────────────────────

    const actual = { dist, distFiles, packed, fixtures }

    const lines: string[] = []
    lines.push("Measured sizes (bytes):")
    lines.push(`  dist total          raw ${dist.raw}  gzip ${dist.gzip}`)
    for (const [file, size] of Object.entries(distFiles)) {
        lines.push(`    ${file.padEnd(24)} raw ${size.raw}  gzip ${size.gzip}`)
    }
    lines.push(`  packed package      raw ${packed.raw}  gzip ${packed.gzip}`)
    for (const [name, size] of Object.entries(fixtures)) {
        lines.push(
            `  fixture ${name.padEnd(19)} raw ${size.raw}  gzip ${size.gzip}`,
        )
    }
    console.log(lines.join("\n"))

    if (updateBaseline) {
        await Bun.write(baselinePath, JSON.stringify(actual, null, 4) + "\n")
        console.log(`\nBaseline written to ${relative(rootDir, baselinePath)}`)
    } else {
        await checkAgainstBaseline(dist, packed, fixtures, FIXTURES)
    }
} finally {
    await rm(tmpDir, { recursive: true, force: true })
}

async function checkAgainstBaseline(
    dist: Size,
    packed: Size,
    fixtures: Record<string, Size>,
    FIXTURES: Record<string, string>,
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
            const pct = ((delta / expected) * 100).toFixed(2)
            const detail =
                `${label} ${metric}: expected ${expected} (ceiling ${ceiling}, ` +
                `baseline + 2%), actual ${size[metric]}, delta ${
                    delta >= 0 ? "+" : ""
                }${delta} bytes (${delta >= 0 ? "+" : ""}${pct}%)`
            if (size[metric] > ceiling) failures.push(detail)
            else if (delta < 0) improvements.push(detail)
        }
    }

    compare("dist total", baseline.dist, dist)
    compare("packed package", baseline.packed, packed)
    for (const name of Object.keys(FIXTURES)) {
        const base = baseline.fixtures?.[name]
        if (!base) {
            failures.push(
                `fixture ${name}: no baseline entry — regenerate the baseline`,
            )
            continue
        }
        compare(`fixture ${name}`, base, fixtures[name])
    }

    if (improvements.length > 0) {
        console.log("\nSize improvements (ratchet the baseline to lock in):")
        for (const line of improvements) console.log(`  ↓ ${line}`)
        console.log(
            "  Ratchet with: VALDRES_UPDATE_SIZE_BASELINE=1 bun run check-size",
        )
    }

    if (failures.length > 0) {
        console.error(`\n${failures.length} size gate(s) exceeded:`)
        for (const line of failures) console.error(`  ✗ ${line}`)
        console.error(
            "\nIf the growth is intended, regenerate the baseline with:\n" +
                "  VALDRES_UPDATE_SIZE_BASELINE=1 bun run check-size",
        )
        process.exitCode = 1
        return
    }

    console.log("\nAll size gates passed")
}
