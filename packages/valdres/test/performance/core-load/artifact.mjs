import { createHash } from "node:crypto"
import {
    lstatSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    realpathSync,
    rmSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { basename, join, relative, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import { isWithin, sha256File } from "./lib.mjs"

export function extractPackedArtifact(tarballPath) {
    const tarball = realpathSync(tarballPath)
    const listing = run("tar", ["-tzf", tarball], "list packed artifact")
    const names = listing
        .split("\n")
        .map(name => name.trim())
        .filter(Boolean)
    if (names.length === 0) throw new Error(`${tarball}: empty tarball`)
    for (const name of names) {
        if (
            name.startsWith("/") ||
            name.includes("\\") ||
            name.split("/").some(part => part === "..") ||
            (name !== "package" && !name.startsWith("package/"))
        ) {
            throw new Error(`${tarball}: unsafe archive member ${name}`)
        }
    }

    const temporaryRoot = mkdtempSync(join(tmpdir(), "valdres-core-load-"))
    try {
        const temporaryRootReal = realpathSync(temporaryRoot)
        run(
            "tar",
            ["-xzf", tarball, "-C", temporaryRoot],
            "extract packed artifact",
        )
        const packageRoot = realpathSync(join(temporaryRoot, "package"))
        if (!isWithin(packageRoot, temporaryRootReal)) {
            throw new Error(
                `${tarball}: package root escapes extraction directory`,
            )
        }
        assertNoLinks(packageRoot)
        const packed = inspectPackedPackage(packageRoot)
        return {
            ...packed,
            tarball,
            tarballName: basename(tarball),
            tarballSha256: sha256File(tarball),
            temporaryRoot,
            cleanup() {
                rmSync(temporaryRoot, { recursive: true, force: true })
            },
        }
    } catch (error) {
        rmSync(temporaryRoot, { recursive: true, force: true })
        throw error
    }
}

export function inspectPackedPackage(packageRootPath) {
    const packageRoot = realpathSync(packageRootPath)
    const packageJsonPath = join(packageRoot, "package.json")
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"))
    if (packageJson.name !== "valdres") {
        throw new Error(
            `${packageJsonPath}: packed package name must be valdres`,
        )
    }
    if (
        typeof packageJson.version !== "string" ||
        packageJson.version.length === 0
    ) {
        throw new Error(`${packageJsonPath}: packed package version is missing`)
    }
    if (packageJson.type !== "module") {
        throw new Error(
            `${packageJsonPath}: benchmark requires a packed ESM package`,
        )
    }

    const exportPath = productionRootExport(packageJson.exports?.["."])
    if (typeof exportPath !== "string" || !exportPath.startsWith("./dist/")) {
        throw new Error(
            `${packageJsonPath}: production root export must point into ./dist/`,
        )
    }
    if (/[/\\]development[/\\]/.test(exportPath)) {
        throw new Error(
            `${packageJsonPath}: development export is not benchmarkable`,
        )
    }
    const entryPath = realpathSync(resolve(packageRoot, exportPath))
    const distRoot = realpathSync(join(packageRoot, "dist"))
    if (!isWithin(entryPath, distRoot)) {
        throw new Error(`${packageJsonPath}: root export escapes packed dist`)
    }

    return {
        packageRoot,
        packageJsonPath,
        entryPath,
        exportPath,
        entrySha256: sha256File(entryPath),
        distTreeSha256: hashTree(distRoot),
        packageMetadata: {
            name: packageJson.name,
            version: packageJson.version,
            gitHead:
                typeof packageJson.gitHead === "string"
                    ? packageJson.gitHead
                    : null,
            exportConditions: rootExportConditions(packageJson.exports?.["."]),
        },
    }
}

export function hashTree(rootPath) {
    const root = realpathSync(rootPath)
    const hash = createHash("sha256")
    for (const path of walkFiles(root)) {
        const name = relative(root, path).split("\\").join("/")
        hash.update(`${name}\0`)
        hash.update(readFileSync(path))
        hash.update("\0")
    }
    return hash.digest("hex")
}

function walkFiles(root) {
    const files = []
    const visit = path => {
        for (const entry of readdirSync(path, { withFileTypes: true }).sort(
            (left, right) => left.name.localeCompare(right.name),
        )) {
            const child = join(path, entry.name)
            if (entry.isSymbolicLink()) {
                throw new Error(
                    `${child}: symlinks are not allowed in benchmark artifacts`,
                )
            }
            if (entry.isDirectory()) visit(child)
            else if (entry.isFile()) files.push(child)
            else throw new Error(`${child}: unsupported artifact file type`)
        }
    }
    visit(root)
    return files
}

function assertNoLinks(root) {
    const visit = path => {
        const stat = lstatSync(path)
        if (stat.isSymbolicLink()) {
            throw new Error(
                `${path}: symlinks are not allowed in benchmark artifacts`,
            )
        }
        if (!stat.isDirectory()) return
        for (const name of readdirSync(path)) visit(join(path, name))
    }
    visit(root)
}

function productionRootExport(rootExport) {
    if (typeof rootExport === "string") return rootExport
    if (rootExport === null || typeof rootExport !== "object") return null
    if (typeof rootExport.import === "string") return rootExport.import
    if (typeof rootExport.default === "string") return rootExport.default
    return null
}

function rootExportConditions(rootExport) {
    if (typeof rootExport === "string") return { default: rootExport }
    if (rootExport === null || typeof rootExport !== "object") return null
    return Object.fromEntries(
        Object.entries(rootExport).filter(
            ([, value]) => typeof value === "string",
        ),
    )
}

function run(command, args, description) {
    const result = spawnSync(command, args, {
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
    })
    if (result.error) throw result.error
    if (result.status !== 0) {
        throw new Error(
            `${description} failed (${command} ${args.join(" ")}): ${result.stderr.trim()}`,
        )
    }
    return result.stdout
}
