/**
 * D43.1 packed reachability evidence.
 *
 * This deliberately does not import the Valdres runtime. It packs one private,
 * preserved-ESM fixture and consumes that exact artifact through four API
 * candidates: standalone/attached ownership × builder/object grammar.
 */
import { createHash } from "node:crypto"
import {
    mkdir,
    mkdtemp,
    readFile,
    readdir,
    rm,
    writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join, relative } from "node:path"
import { build as esbuild } from "esbuild"
import { format, resolveConfig } from "prettier"
import { build as viteBuild } from "vite"
import webpack from "webpack"

const GZIP_LEVEL = 6
const PACKAGE_NAME = "@valdres/query-construction-spike"
const COLLECTION_SENTINEL = "D431_COLLECTION_SENTINEL_7M4Q2X9K6P1V8R5C"
const ENGINE_SENTINEL = "D431_ENGINE_SENTINEL_9Q2M7V4K1X8P6R5C"
const BUILDER_SENTINEL = "D431_BUILDER_SENTINEL_5R8P1X4K7V2M9Q6C"
const OBJECT_SENTINEL = "D431_OBJECT_SENTINEL_2V9K6P3R8M1X7Q5C"

const spikeDir = import.meta.dir
const rootDir = join(spikeDir, "../../../../..")
const fixturePackageDir = join(spikeDir, "packed-package")
const snapshotPath = join(spikeDir, "reachability.snapshot.json")
const updateSnapshot = process.argv.includes("--update")

type Ownership = "standalone" | "attached"
type Grammar = "builder" | "object"
type Usage = "filterless" | "membership" | "order-array" | "query"
type Tool = "bun" | "esbuild" | "vite-rollup" | "webpack"

type CaseDefinition = {
    id: string
    exportPath: string
    ownership: Ownership | "narrow"
    grammar: Grammar | "none"
    usage: Usage
}

type Markers = {
    collection: boolean
    engine: boolean
    builder: boolean
    object: boolean
}

type BundleEvidence = {
    raw: number
    gzip: number
    sha256: string
    markers: Markers
    fixtureModules?: string[]
}

const cases: CaseDefinition[] = [
    {
        id: "narrow-collection-membership",
        exportPath: "collection",
        ownership: "narrow",
        grammar: "none",
        usage: "membership",
    },
    ...(["standalone", "attached"] as const).flatMap(ownership =>
        (["builder", "object"] as const).flatMap(grammar =>
            (["membership", "query"] as const).map(usage => ({
                id: `${ownership}-${grammar}-${usage}`,
                exportPath: `${ownership}-${grammar}`,
                ownership,
                grammar,
                usage,
            })),
        ),
    ),
    {
        id: "standalone-builder-filterless",
        exportPath: "standalone-builder",
        ownership: "standalone",
        grammar: "builder",
        usage: "filterless",
    },
    {
        id: "standalone-object-filterless",
        exportPath: "standalone-object",
        ownership: "standalone",
        grammar: "object",
        usage: "filterless",
    },
    {
        id: "standalone-object-order-array",
        exportPath: "standalone-object",
        ownership: "standalone",
        grammar: "object",
        usage: "order-array",
    },
]

const rowsSource = `[
    { id: "m2", title: "Beta", genre: "drama", tags: ["award-winner"], rating: 8, releasedAt: 2018 },
    { id: "m6", title: "Zeta", genre: "drama", tags: ["classic"], rating: 8.2, releasedAt: 2021 },
    { id: "m1", title: "Alpha", genre: "drama", tags: ["classic"], rating: 9, releasedAt: 2024 },
    { id: "m5", title: "Epsilon", genre: "drama", tags: ["award-winner", "classic"], rating: 8.5, releasedAt: 2023 },
    { id: "m3", title: "Gamma", genre: "comedy", tags: ["classic"], rating: 10, releasedAt: 2025 },
    { id: "m4", title: "Delta", genre: "drama", tags: ["family"], rating: 9, releasedAt: 2022 },
    { id: "m7", title: "Eta", genre: "drama", tags: ["classic"], rating: 7, releasedAt: 2026 },
]`

function consumerSource(definition: CaseDefinition) {
    const specifier = `${PACKAGE_NAME}/${definition.exportPath}`
    if (definition.usage === "membership") {
        return `import { collection, inspectCollection } from ${JSON.stringify(specifier)}

const movies = collection(${rowsSource})
globalThis.__D431_CAPTURE__?.(movies)
const output = inspectCollection(movies)
globalThis.__D431_RESULT__ = output
console.log(JSON.stringify(output))
`
    }

    const queryImport =
        definition.ownership === "standalone"
            ? "import { collection, query }"
            : "import { collection }"
    const builderDefinition =
        definition.usage === "filterless"
            ? `q => {
    definitionCalls++
    return ({ limit: 2 })
}`
            : `q => {
    definitionCalls++
    return ({
    where: q.all(
        q.index.genre.eq("drama"),
        q.index.tags.hasAny(["award-winner", "classic"]),
        q.index.rating.gte(8),
    ),
    orderBy: q.index.releasedAt.desc(),
    facets: {
        genre: q.index.genre.facet({ mode: "disjunctive" }),
        tags: q.index.tags.facet({ mode: "disjunctive" }),
    },
    offset: 1,
    limit: 2,
    })
}`
    const objectDefinition =
        definition.usage === "filterless"
            ? `{ limit: 2 }`
            : definition.usage === "order-array"
              ? `{
    orderBy: [{ rating: "desc" }, { releasedAt: "desc" }],
    limit: 4,
}`
              : `{
    where: {
        genre: { eq: "drama" },
        tags: { hasAny: ["award-winner", "classic"] },
        rating: { gte: 8 },
    },
    orderBy: { releasedAt: "desc" },
    facets: {
        genre: { mode: "disjunctive" },
        tags: { mode: "disjunctive" },
    },
    offset: 1,
    limit: 2,
}`
    const queryDefinition =
        definition.grammar === "builder" ? builderDefinition : objectDefinition
    const createQuery =
        definition.ownership === "standalone"
            ? `query(movies, ${queryDefinition})`
            : `movies.query(${queryDefinition})`

    return `${queryImport} from ${JSON.stringify(specifier)}

const movies = collection(${rowsSource})
globalThis.__D431_CAPTURE__?.(movies)
let definitionCalls = 0
const queryNode = ${createQuery}
const firstRead = queryNode.read()
const secondRead = queryNode.read()
const output = {
    ...firstRead,
    definitionCalls,
    repeatStable: JSON.stringify(firstRead) === JSON.stringify(secondRead),
}
globalThis.__D431_RESULT__ = output
console.log(JSON.stringify(output))
`
}

function expectedOutput(definition: CaseDefinition) {
    if (definition.usage === "membership") {
        return {
            kind: "collection",
            marker: COLLECTION_SENTINEL,
            count: 7,
            first: "Alpha",
        }
    }
    if (definition.usage === "filterless") {
        return {
            rows: ["m1", "m2"],
            total: 7,
            facets: {},
            engine: ENGINE_SENTINEL,
            grammar:
                definition.grammar === "builder"
                    ? BUILDER_SENTINEL
                    : OBJECT_SENTINEL,
            definitionCalls: definition.grammar === "builder" ? 1 : 0,
            repeatStable: true,
        }
    }
    if (definition.usage === "order-array") {
        return {
            rows: ["m3", "m1", "m4", "m5"],
            total: 7,
            facets: {},
            engine: ENGINE_SENTINEL,
            grammar: OBJECT_SENTINEL,
            definitionCalls: 0,
            repeatStable: true,
        }
    }
    return {
        rows: ["m5", "m6"],
        total: 4,
        facets: {
            genre: [{ value: "drama", count: 4 }],
            tags: [
                { value: "award-winner", count: 2 },
                { value: "classic", count: 3 },
            ],
        },
        engine: ENGINE_SENTINEL,
        grammar:
            definition.grammar === "builder"
                ? BUILDER_SENTINEL
                : OBJECT_SENTINEL,
        definitionCalls: definition.grammar === "builder" ? 1 : 0,
        repeatStable: true,
    }
}

function expectedMarkers(definition: CaseDefinition): Markers {
    const retainsQuery =
        definition.usage !== "membership" || definition.ownership === "attached"
    return {
        collection: true,
        engine: retainsQuery,
        builder: retainsQuery && definition.grammar === "builder",
        object: retainsQuery && definition.grammar === "object",
    }
}

function run(command: string[], cwd: string) {
    const result = Bun.spawnSync(command, {
        cwd,
        env: { ...process.env, FORCE_COLOR: "0" },
        stdio: ["ignore", "pipe", "pipe"],
    })
    const stdout = result.stdout.toString()
    const stderr = result.stderr.toString()
    if (result.exitCode !== 0) {
        throw new Error(
            `\`${command.join(" ")}\` failed in ${cwd}:\n${stdout}${stderr}`,
        )
    }
    return { stdout, stderr }
}

function sha256(input: string | Uint8Array) {
    return createHash("sha256").update(input).digest("hex")
}

function markersIn(source: string): Markers {
    return {
        collection: source.includes(COLLECTION_SENTINEL),
        engine: source.includes(ENGINE_SENTINEL),
        builder: source.includes(BUILDER_SENTINEL),
        object: source.includes(OBJECT_SENTINEL),
    }
}

function metric(source: string, fixtureModules?: string[]): BundleEvidence {
    const bytes = new TextEncoder().encode(source)
    return {
        raw: bytes.length,
        gzip: Bun.gzipSync(bytes, { level: GZIP_LEVEL }).length,
        sha256: sha256(bytes),
        markers: markersIn(source),
        ...(fixtureModules
            ? { fixtureModules: [...new Set(fixtureModules)].sort() }
            : {}),
    }
}

function fixtureRole(input: string) {
    const normalized = input.replaceAll("\\", "/")
    const marker = `${PACKAGE_NAME}/esm/`
    const index = normalized.lastIndexOf(marker)
    if (index >= 0) return normalized.slice(index + marker.length)
    const nodeModulesMarker =
        "node_modules/@valdres/query-construction-spike/esm/"
    const nodeModulesIndex = normalized.lastIndexOf(nodeModulesMarker)
    if (nodeModulesIndex >= 0)
        return normalized.slice(nodeModulesIndex + nodeModulesMarker.length)
    return undefined
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string) {
    const actualJson = JSON.stringify(actual)
    const expectedJson = JSON.stringify(expected)
    if (actualJson !== expectedJson) {
        throw new Error(
            `${message}\nexpected: ${expectedJson}\nactual:   ${actualJson}`,
        )
    }
}

async function executeBundle(
    source: string,
    outputPath: string,
    expected: unknown,
) {
    await mkdir(join(outputPath, ".."), { recursive: true })
    await writeFile(outputPath, source)
    const { stdout } = run(["node", outputPath], rootDir)
    const line = stdout.trim().split("\n").at(-1)
    if (!line) throw new Error(`No runtime output from ${outputPath}`)
    const actual = JSON.parse(line)
    assertDeepEqual(actual, expected, `Runtime mismatch for ${outputPath}`)
}

async function buildWithBun(entry: string) {
    const result = await Bun.build({
        entrypoints: [entry],
        format: "esm",
        minify: true,
        target: "browser",
        sourcemap: "none",
        define: { "process.env.NODE_ENV": JSON.stringify("production") },
    })
    if (!result.success) {
        throw new Error(`Bun build failed:\n${result.logs.join("\n")}`)
    }
    if (result.outputs.length !== 1) {
        throw new Error(`Expected one Bun output, got ${result.outputs.length}`)
    }
    return { source: await result.outputs[0].text() }
}

async function buildWithEsbuild(entry: string, consumerDir: string) {
    const result = await esbuild({
        absWorkingDir: consumerDir,
        bundle: true,
        entryPoints: [entry],
        format: "esm",
        legalComments: "none",
        metafile: true,
        minify: true,
        platform: "browser",
        target: "es2022",
        treeShaking: true,
        write: false,
    })
    if (result.outputFiles.length !== 1) {
        throw new Error(
            `Expected one esbuild output, got ${result.outputFiles.length}`,
        )
    }
    const modules = Object.values(result.metafile.outputs)
        .flatMap(output =>
            Object.entries(output.inputs)
                .filter(([, input]) => input.bytesInOutput > 0)
                .map(([input]) => fixtureRole(input)),
        )
        .filter((role): role is string => Boolean(role))
    return { source: result.outputFiles[0].text, modules }
}

async function buildWithVite(entry: string, consumerDir: string) {
    const built = (await viteBuild({
        configFile: false,
        root: consumerDir,
        logLevel: "silent",
        build: {
            emptyOutDir: false,
            lib: {
                entry,
                fileName: "bundle",
                formats: ["es"],
            },
            minify: "esbuild",
            target: "es2022",
            write: false,
            rollupOptions: {
                output: {
                    inlineDynamicImports: true,
                },
            },
        },
    })) as any
    const output = Array.isArray(built)
        ? built.flatMap(item => item.output)
        : built.output
    const chunks = output.filter((item: any) => item.type === "chunk")
    if (chunks.length !== 1) {
        throw new Error(`Expected one Vite chunk, got ${chunks.length}`)
    }
    const modules = Object.entries(chunks[0].modules)
        .filter(([, details]: [string, any]) => details.renderedLength > 0)
        .map(([input]) => fixtureRole(input))
        .filter((role): role is string => Boolean(role))
    return { source: chunks[0].code as string, modules }
}

async function buildWithWebpack(
    entry: string,
    consumerDir: string,
    outputDir: string,
) {
    await rm(outputDir, { recursive: true, force: true })
    await mkdir(outputDir, { recursive: true })
    const stats = await new Promise<any>((resolvePromise, reject) => {
        const compiler = webpack({
            mode: "production",
            context: consumerDir,
            devtool: false,
            entry,
            experiments: { outputModule: true },
            optimization: {
                // Webpack's default deterministic IDs hash absolute module
                // paths. This fixture is intentionally installed under a new
                // temp directory on every run, so traversal-stable natural IDs
                // keep the emitted evidence independent of that path.
                chunkIds: "natural",
                concatenateModules: false,
                minimize: true,
                moduleIds: "natural",
                usedExports: true,
            },
            output: {
                clean: true,
                filename: "bundle.mjs",
                module: true,
                path: outputDir,
            },
            target: ["web", "es2022"],
        })
        if (!compiler) {
            reject(new Error("Webpack did not create a compiler"))
            return
        }
        compiler.run((error, result) => {
            const buildError =
                error ??
                (result?.hasErrors()
                    ? new Error(result.toString({ all: false, errors: true }))
                    : undefined)
            compiler.close(closeError => {
                if (buildError || closeError) reject(buildError ?? closeError)
                else resolvePromise(result)
            })
        })
    })
    const source = await readFile(join(outputDir, "bundle.mjs"), "utf8")
    const modules: string[] = []
    for (const module of stats.compilation.modules) {
        const included =
            stats.compilation.chunkGraph.getNumberOfModuleChunks(module) > 0
        const role = fixtureRole(module.resource ?? module.identifier?.() ?? "")
        if (included && role) modules.push(role)
    }
    return { source, modules }
}

async function build(
    tool: Tool,
    entry: string,
    consumerDir: string,
    outputDir: string,
): Promise<{ source: string; modules?: string[] }> {
    if (tool === "bun") return buildWithBun(entry)
    if (tool === "esbuild") return buildWithEsbuild(entry, consumerDir)
    if (tool === "vite-rollup") return buildWithVite(entry, consumerDir)
    return buildWithWebpack(entry, consumerDir, outputDir)
}

function assertBundle(
    evidence: BundleEvidence,
    definition: CaseDefinition,
    tool: Tool,
) {
    assertDeepEqual(
        evidence.markers,
        expectedMarkers(definition),
        `${tool}/${definition.id} retained the wrong sentinels`,
    )
    if (tool === "bun") return

    const modules = new Set(evidence.fixtureModules)
    const expected = expectedMarkers(definition)
    const checks: Array<[string, boolean]> = [
        ["collection.js", true],
        ["query-engine.js", expected.engine],
        ["query-builder.js", expected.builder],
        ["query-object.js", expected.object],
    ]
    for (const [role, shouldExist] of checks) {
        if (modules.has(role) !== shouldExist) {
            throw new Error(
                `${tool}/${definition.id}: ${role} graph presence was ${modules.has(
                    role,
                )}, expected ${shouldExist}; modules=${JSON.stringify([...modules])}`,
            )
        }
    }
}

async function listFiles(directory: string) {
    const entries = await readdir(directory, {
        recursive: true,
        withFileTypes: true,
    })
    return entries
        .filter(entry => entry.isFile())
        .map(entry => join(entry.parentPath, entry.name))
        .sort()
}

async function packageEvidence(packageDir: string) {
    const files: Record<string, { raw: number; sha256: string }> = {}
    for (const file of await listFiles(packageDir)) {
        const bytes = new Uint8Array(await Bun.file(file).arrayBuffer())
        files[relative(packageDir, file)] = {
            raw: bytes.length,
            sha256: sha256(bytes),
        }
    }
    return {
        files,
        canonicalSha256: sha256(
            Object.entries(files)
                .map(([file, value]) => `${file}\0${value.sha256}\0`)
                .join(""),
        ),
    }
}

async function nativeEvidence(
    definition: CaseDefinition,
    entry: string,
    consumerDir: string,
    hookPath: string,
) {
    const expected = expectedOutput(definition)
    const node = run(["node", "--import", hookPath, entry], consumerDir)
    const bun = run(["bun", entry], consumerDir)
    const nodeLine = node.stdout.trim().split("\n").at(-1)
    const bunLine = bun.stdout.trim().split("\n").at(-1)
    if (!nodeLine || !bunLine)
        throw new Error(`Missing native output for ${definition.id}`)
    const nodeOutput = JSON.parse(nodeLine)
    const bunOutput = JSON.parse(bunLine)
    assertDeepEqual(nodeOutput, expected, `Node native ${definition.id}`)
    assertDeepEqual(bunOutput, expected, `Bun native ${definition.id}`)

    const modules = node.stderr
        .split("\n")
        .filter(line => line.startsWith("D431_LOAD:"))
        .map(line => line.slice("D431_LOAD:".length))
        .sort()
    const moduleSet = new Set(modules)
    const queryExpected = definition.ownership !== "narrow"
    const checks: Array<[string, boolean]> = [
        ["collection.js", true],
        ["query-engine.js", queryExpected],
        ["query-builder.js", queryExpected && definition.grammar === "builder"],
        ["query-object.js", queryExpected && definition.grammar === "object"],
    ]
    for (const [role, shouldExist] of checks) {
        if (moduleSet.has(role) !== shouldExist) {
            throw new Error(
                `Native ${definition.id}: ${role} linkage was ${moduleSet.has(
                    role,
                )}, expected ${shouldExist}; modules=${JSON.stringify(modules)}`,
            )
        }
    }
    return { nodeFixtureModules: modules, node: nodeOutput, bun: bunOutput }
}

function deterministicNoise(length: number) {
    const alphabet =
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    let state = 0x6d2b79f5
    let output = ""
    for (let index = 0; index < length; index++) {
        state = Math.imul(state ^ (state >>> 15), state | 1)
        state ^= state + Math.imul(state ^ (state >>> 7), state | 61)
        output += alphabet[((state ^ (state >>> 14)) >>> 0) % alphabet.length]
    }
    return output
}

function delta(left: BundleEvidence, right: BundleEvidence) {
    return {
        raw: right.raw - left.raw,
        gzip: right.gzip - left.gzip,
    }
}

function comparisons(bundles: Record<Tool, Record<string, BundleEvidence>>) {
    return Object.fromEntries(
        (Object.keys(bundles) as Tool[]).map(tool => {
            const evidence = bundles[tool]
            return [
                tool,
                {
                    builderAttachedMembershipCost: delta(
                        evidence["standalone-builder-membership"],
                        evidence["attached-builder-membership"],
                    ),
                    objectAttachedMembershipCost: delta(
                        evidence["standalone-object-membership"],
                        evidence["attached-object-membership"],
                    ),
                    builderAttachedQueryCost: delta(
                        evidence["standalone-builder-query"],
                        evidence["attached-builder-query"],
                    ),
                    objectAttachedQueryCost: delta(
                        evidence["standalone-object-query"],
                        evidence["attached-object-query"],
                    ),
                    standaloneObjectVsBuilderQuery: delta(
                        evidence["standalone-builder-query"],
                        evidence["standalone-object-query"],
                    ),
                    attachedObjectVsBuilderQuery: delta(
                        evidence["attached-builder-query"],
                        evidence["attached-object-query"],
                    ),
                },
            ]
        }),
    )
}

const tempDir = await mkdtemp(join(tmpdir(), "valdres-d43.1-"))
try {
    const packDir = join(tempDir, "pack")
    const consumerDir = join(tempDir, "consumer")
    await mkdir(packDir, { recursive: true })
    await mkdir(join(consumerDir, "node_modules", "@valdres"), {
        recursive: true,
    })
    await writeFile(
        join(consumerDir, "package.json"),
        JSON.stringify({ private: true, type: "module" }),
    )

    const packed = run(
        [
            "npm",
            "pack",
            "--ignore-scripts",
            "--json",
            "--pack-destination",
            packDir,
        ],
        fixturePackageDir,
    )
    const [{ filename }] = JSON.parse(packed.stdout)
    const tarballPath = join(packDir, filename)
    const installedPackageDir = join(
        consumerDir,
        "node_modules",
        "@valdres",
        "query-construction-spike",
    )
    await mkdir(installedPackageDir, { recursive: true })
    run(
        [
            "tar",
            "-xzf",
            tarballPath,
            "-C",
            installedPackageDir,
            "--strip-components=1",
        ],
        consumerDir,
    )

    const hookPath = join(consumerDir, "native-hook.mjs")
    await writeFile(
        hookPath,
        `import { registerHooks } from "node:module"
registerHooks({
    load(url, context, nextLoad) {
        const marker = "/node_modules/@valdres/query-construction-spike/esm/"
        const index = url.lastIndexOf(marker)
        if (index >= 0) process.stderr.write("D431_LOAD:" + url.slice(index + marker.length) + "\\n")
        return nextLoad(url, context)
    },
})
`,
    )

    const entries: Record<string, string> = {}
    for (const definition of cases) {
        const entry = join(consumerDir, `${definition.id}.mjs`)
        await writeFile(entry, consumerSource(definition))
        entries[definition.id] = entry
    }

    const tools: Tool[] = ["bun", "esbuild", "vite-rollup", "webpack"]
    const bundles = Object.fromEntries(tools.map(tool => [tool, {}])) as Record<
        Tool,
        Record<string, BundleEvidence>
    >
    for (const tool of tools) {
        for (const definition of cases) {
            const outputDir = join(tempDir, "outputs", tool, definition.id)
            const first = await build(
                tool,
                entries[definition.id],
                consumerDir,
                outputDir,
            )
            const firstEvidence = metric(first.source, first.modules)
            assertBundle(firstEvidence, definition, tool)
            await executeBundle(
                first.source,
                join(outputDir, "runtime.mjs"),
                expectedOutput(definition),
            )

            const second = await build(
                tool,
                entries[definition.id],
                consumerDir,
                outputDir,
            )
            const secondEvidence = metric(second.source, second.modules)
            assertDeepEqual(
                secondEvidence,
                firstEvidence,
                `${tool}/${definition.id} was not deterministic across two clean builds`,
            )
            bundles[tool][definition.id] = firstEvidence
        }
    }

    const native = Object.fromEntries(
        await Promise.all(
            cases.map(async definition => [
                definition.id,
                await nativeEvidence(
                    definition,
                    entries[definition.id],
                    consumerDir,
                    hookPath,
                ),
            ]),
        ),
    )

    const enginePath = join(installedPackageDir, "esm", "query-engine.js")
    const originalEngine = await readFile(enginePath, "utf8")
    const inflatedEngine = originalEngine.replace(
        ENGINE_SENTINEL,
        `${ENGINE_SENTINEL}_${deterministicNoise(4096)}`,
    )
    if (inflatedEngine === originalEngine)
        throw new Error("Red proof could not find the engine sentinel")
    await writeFile(enginePath, inflatedEngine)

    const redProof = Object.fromEntries(
        await Promise.all(
            tools.map(async tool => {
                const toolResult: Record<
                    string,
                    { changed: boolean; rawDelta: number; gzipDelta: number }
                > = {}
                for (const definition of cases) {
                    const mutated = await build(
                        tool,
                        entries[definition.id],
                        consumerDir,
                        join(tempDir, "outputs-red", tool, definition.id),
                    )
                    const mutatedEvidence = metric(
                        mutated.source,
                        mutated.modules,
                    )
                    const baseline = bundles[tool][definition.id]
                    const shouldChange = expectedMarkers(definition).engine
                    const changed = baseline.sha256 !== mutatedEvidence.sha256
                    if (changed !== shouldChange) {
                        throw new Error(
                            `${tool}/${definition.id} red proof changed=${changed}, expected ${shouldChange}`,
                        )
                    }
                    const rawDelta = mutatedEvidence.raw - baseline.raw
                    const gzipDelta = mutatedEvidence.gzip - baseline.gzip
                    if (shouldChange && (rawDelta < 3500 || gzipDelta < 2500)) {
                        throw new Error(
                            `${tool}/${definition.id} red proof was too weak: raw ${rawDelta}, gzip ${gzipDelta}`,
                        )
                    }
                    toolResult[definition.id] = {
                        changed,
                        rawDelta,
                        gzipDelta,
                    }
                }
                return [tool, toolResult]
            }),
        ),
    )
    await writeFile(enginePath, originalEngine)

    const packageJson = await Bun.file(
        join(installedPackageDir, "package.json"),
    ).json()
    const toolVersions = {
        bun: Bun.version,
        bunNodeCompatibility: process.versions.node,
        node: run(["node", "--version"], rootDir)
            .stdout.trim()
            .replace(/^v/, ""),
        npm: run(["npm", "--version"], rootDir).stdout.trim(),
        esbuild: (
            await Bun.file(
                join(rootDir, "node_modules/esbuild/package.json"),
            ).json()
        ).version,
        vite: (
            await Bun.file(
                join(rootDir, "node_modules/vite/package.json"),
            ).json()
        ).version,
        rollup: (
            await Bun.file(
                join(rootDir, "node_modules/rollup/package.json"),
            ).json()
        ).version,
        webpack: (
            await Bun.file(
                join(rootDir, "node_modules/webpack/package.json"),
            ).json()
        ).version,
    }
    const evidence = {
        schemaVersion: 1,
        experiment: "D43.1 packed query-construction reachability",
        interpretation: {
            valid: [
                "Reachability and relative size under the pinned tool matrix for this straightforward preserved-ESM implementation.",
                "Native ESM linkage for the tested export map.",
                "Whether the harness detects a large observable query-engine boundary mutation.",
            ],
            invalid: [
                "A production Valdres byte budget.",
                "Proof that every possible attached-method implementation must retain the same bytes.",
                "A grammar DX or runtime-performance winner.",
                "Marginal whole-application cost when shared chunks or another query import already make the query tier reachable.",
                "The eventual Valdres production build and export topology.",
                "A direct Bun native-ESM module-linkage trace; Bun is behavior-smoked while Node supplies the trace.",
                "The size of complete production grammar validation and normalization.",
                "A reference oracle for production State, row-handle, ordering, or facet semantics.",
            ],
        },
        tools: toolVersions,
        packedPackage: {
            name: packageJson.name,
            version: packageJson.version,
            sideEffects: packageJson.sideEffects,
            tarball: basename(tarballPath),
            ...(await packageEvidence(installedPackageDir)),
        },
        cases: cases.map(definition => ({
            ...definition,
            expectedMarkers: expectedMarkers(definition),
        })),
        bundles,
        native,
        comparisons: comparisons(bundles),
        redProof,
    }
    const serialized = await format(JSON.stringify(evidence), {
        ...(await resolveConfig(snapshotPath)),
        parser: "json",
    })

    if (updateSnapshot) {
        await writeFile(snapshotPath, serialized)
        console.log(
            `Updated ${relative(rootDir, snapshotPath)} (${cases.length} cases × ${tools.length} bundlers)`,
        )
    } else {
        const expected = await readFile(snapshotPath, "utf8").catch(() => "")
        if (expected !== serialized) {
            throw new Error(
                `Packed reachability snapshot changed. Review and update with:\n` +
                    `  bun ${relative(rootDir, import.meta.path)} --update`,
            )
        }
        console.log(
            `Packed reachability snapshot matches (${cases.length} cases × ${tools.length} bundlers; native Node/Bun; red proof green)`,
        )
    }
} finally {
    await rm(tempDir, { recursive: true, force: true })
}
