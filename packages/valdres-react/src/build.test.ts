import { afterAll, describe, expect, test } from "bun:test"
import { build as esbuild } from "esbuild"
import {
    mkdir,
    mkdtemp,
    readdir,
    readFile,
    rm,
    writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { buildOptions, removeStaleBuildJavaScript } from "../build"

const packageDirectory = resolve(import.meta.dir, "..")
const temporaryDirectories: string[] = []
const ROOT_PACKED_GRAPH_RAW_BUDGET = 1_400

const temporaryDirectory = async (prefix: string): Promise<string> => {
    const directory = await mkdtemp(join(tmpdir(), prefix))
    temporaryDirectories.push(directory)
    return directory
}

const run = (
    command: string[],
    cwd: string,
): { exitCode: number; stdout: string; stderr: string } => {
    const result = Bun.spawnSync(command, {
        cwd,
        stdout: "pipe",
        stderr: "pipe",
    })
    return {
        exitCode: result.exitCode,
        stdout: result.stdout.toString(),
        stderr: result.stderr.toString(),
    }
}

let builtDistPromise: Promise<string> | undefined
const builtDist = (): Promise<string> =>
    (builtDistPromise ??= (async () => {
        const outdir = await temporaryDirectory("valdres-react-dist-")
        const result = await Bun.build({ ...buildOptions, outdir })
        expect(result.success, result.logs.join("\n")).toBe(true)
        return outdir
    })())

const importedJavaScript = (source: string): string[] =>
    [...source.matchAll(/(?:from\s+|import\s*)["'](\.\/[^"']+\.js)["']/g)]
        .map(match => match[1])
        .sort()

afterAll(async () => {
    await Promise.all(
        temporaryDirectories.map(directory =>
            rm(directory, { recursive: true, force: true }),
        ),
    )
})

describe("valdres-react split build", () => {
    test("shares one StoreContext chunk between root and inspect entries", async () => {
        const dist = await builtDist()
        const files = (await readdir(dist, { recursive: true })).filter(file =>
            file.endsWith(".js"),
        )
        expect(files).toContain("index.js")
        expect(files).toContain("inspect.js")

        const sources = new Map(
            await Promise.all(
                files.map(
                    async file =>
                        [
                            file,
                            await readFile(join(dist, file), "utf8"),
                        ] as const,
                ),
            ),
        )
        const storeContextOwners = [...sources].filter(([, source]) =>
            source.includes("var StoreContext = createContext("),
        )
        expect(storeContextOwners).toHaveLength(1)

        const contextFile = storeContextOwners[0][0]
        const contextSpecifier = `./${contextFile}`
        expect(importedJavaScript(sources.get("index.js")!)).toContain(
            contextSpecifier,
        )
        expect(importedJavaScript(sources.get("inspect.js")!)).toContain(
            contextSpecifier,
        )
    })

    test("keeps the exact root surface and inspect source out of a root-only graph", async () => {
        const result = await esbuild({
            absWorkingDir: packageDirectory,
            bundle: true,
            entryPoints: ["src/index.ts"],
            format: "esm",
            metafile: true,
            packages: "external",
            platform: "browser",
            write: false,
        })
        const inputs = Object.keys(result.metafile.inputs).map(path =>
            path.replaceAll("\\", "/"),
        )
        expect(inputs.some(path => path.endsWith("src/inspect.tsx"))).toBe(
            false,
        )

        const entryOutput = Object.values(result.metafile.outputs).find(
            output => output.entryPoint !== undefined,
        )
        expect(entryOutput?.exports.sort()).toEqual([
            "Provider",
            "useAtom",
            "useResetAtom",
            "useSetAtom",
            "useStore",
            "useUpdateAtom",
            "useValue",
        ])
    })

    test("keeps the packed root graph within its inspection-free byte budget", async () => {
        const dist = await builtDist()
        const result = await esbuild({
            bundle: true,
            entryPoints: [join(dist, "index.js")],
            format: "esm",
            metafile: true,
            minify: true,
            packages: "external",
            platform: "browser",
            write: false,
        })
        const inputs = Object.keys(result.metafile.inputs).map(path =>
            path.replaceAll("\\", "/"),
        )
        expect(inputs.some(path => path.endsWith("/inspect.js"))).toBe(false)
        expect(result.outputFiles).toHaveLength(1)
        expect(result.outputFiles[0].contents.length).toBeLessThanOrEqual(
            ROOT_PACKED_GRAPH_RAW_BUDGET,
        )
    })

    test("emits separate root and inspect declaration entries", async () => {
        const outdir = await temporaryDirectory("valdres-react-types-")
        const result = run(
            [
                resolve(import.meta.dir, "../../../node_modules/.bin/tsc"),
                "-p",
                join(packageDirectory, "tsconfig.json"),
                "--outDir",
                outdir,
            ],
            packageDirectory,
        )
        expect(result.exitCode, result.stderr).toBe(0)
        expect(
            (await readFile(join(outdir, "index.d.ts"), "utf8")).length,
        ).toBeGreaterThan(0)
        expect(
            (await readFile(join(outdir, "inspect.d.ts"), "utf8")).length,
        ).toBeGreaterThan(0)
    })

    test("removes stale split chunks without deleting declarations", async () => {
        const outdir = await temporaryDirectory("valdres-react-clean-")
        await mkdir(join(outdir, "nested"))
        await Promise.all([
            writeFile(join(outdir, "index.js"), "old index"),
            writeFile(join(outdir, "inspect.js"), "old inspect"),
            writeFile(join(outdir, "chunk-old.js"), "old chunk"),
            writeFile(join(outdir, "chunk-old.js.map"), "old map"),
            writeFile(join(outdir, "nested", "chunk.js"), "old nested"),
            writeFile(join(outdir, "index.d.ts"), "export {}"),
        ])

        await removeStaleBuildJavaScript(outdir)

        expect(await readdir(outdir)).toEqual(["index.d.ts"])
    })
})
