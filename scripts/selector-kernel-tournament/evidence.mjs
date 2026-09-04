import {
    existsSync,
    lstatSync,
    readdirSync,
    readFileSync,
    writeFileSync,
    mkdirSync,
    realpathSync,
} from "node:fs"
import { join, resolve, relative, dirname } from "node:path"
import { fileHash, sha256, json, requireGate, exactRows } from "./inputs.mjs"
export function evidencePath(root, path) {
    requireGate(
        typeof path === "string" &&
            path.length > 0 &&
            !path.includes("\\") &&
            !/[\r\n\0]/.test(path) &&
            !path.startsWith("/") &&
            !path.split("/").some(p => p === ".." || p === "." || p === ""),
        "EVIDENCE-PATH",
        String(path),
    )
    const result = resolve(root, path)
    requireGate(result.startsWith(resolve(root) + "/"), "EVIDENCE-PATH", path)
    let cursor = root
    for (const part of path.split("/")) {
        cursor = join(cursor, part)
        if (existsSync(cursor))
            requireGate(
                !lstatSync(cursor).isSymbolicLink(),
                "EVIDENCE-SYMLINK",
                path,
            )
    }
    return result
}
export function writeEvidence(root, path, value) {
    requireGate(
        !existsSync(join(root, "SHA256SUMS")),
        "EVIDENCE-IMMUTABLE",
        "bundle is sealed",
    )
    const file = evidencePath(root, path)
    requireGate(!existsSync(file), "EVIDENCE-IMMUTABLE", path)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(
        file,
        typeof value === "string"
            ? value
            : JSON.stringify(value, null, 2) + "\n",
        { flag: "wx" },
    )
    return { path, sha256: fileHash(file), bytes: lstatSync(file).size }
}
export function evidenceFiles(root) {
    const output = []
    function visit(directory) {
        for (const name of readdirSync(directory).sort()) {
            const path = join(directory, name),
                stat = lstatSync(path)
            requireGate(!stat.isSymbolicLink(), "EVIDENCE-SYMLINK", path)
            if (stat.isDirectory()) visit(path)
            else {
                requireGate(stat.isFile(), "EVIDENCE-FILE", path)
                output.push(relative(root, path))
            }
        }
    }
    visit(root)
    return output.sort()
}
export function artifactInventory(
    root,
    excluded = ["SHA256SUMS", "report.json", "report.md"],
) {
    return evidenceFiles(root)
        .filter(path => !excluded.includes(path))
        .map(path => ({
            path,
            sha256: fileHash(evidencePath(root, path)),
            bytes: lstatSync(evidencePath(root, path)).size,
        }))
}
export function sealEvidence(root) {
    requireGate(
        !existsSync(join(root, "SHA256SUMS")),
        "EVIDENCE-IMMUTABLE",
        "already sealed",
    )
    const text = evidenceFiles(root)
        .map(path => `${fileHash(evidencePath(root, path))}  ${path}\n`)
        .join("")
    writeEvidence(root, "SHA256SUMS", text)
    verifySeal(root)
    return fileHash(join(root, "SHA256SUMS"))
}
export function verifySeal(root, expectedSha256) {
    const file = join(root, "SHA256SUMS")
    requireGate(existsSync(file), "EVIDENCE-MISSING", "SHA256SUMS")
    if (expectedSha256)
        requireGate(
            fileHash(file) === expectedSha256,
            "EVIDENCE-SUMS-HASH",
            "SHA256SUMS",
        )
    const text = readFileSync(file, "utf8")
    requireGate(text.endsWith("\n"), "EVIDENCE-SUMS", "missing final newline")
    const rows = text
        .slice(0, -1)
        .split("\n")
        .map(line => {
            const match = /^([a-f0-9]{64})  (.+)$/.exec(line)
            requireGate(match, "EVIDENCE-SUMS", "invalid line")
            return { sha256: match[1], path: match[2] }
        })
    exactRows(
        rows.map(row => row.path),
        evidenceFiles(root).filter(p => p !== "SHA256SUMS"),
        "EVIDENCE-MEMBERSHIP",
    )
    for (const row of rows)
        requireGate(
            fileHash(evidencePath(root, row.path)) === row.sha256,
            "EVIDENCE-HASH",
            row.path,
        )
    return rows
}
export function verifyArtifacts(root, artifacts) {
    exactRows(
        artifacts.map(row => row.path),
        artifactInventory(root).map(row => row.path),
        "EVIDENCE-MEMBERSHIP",
    )
    for (const row of artifacts) {
        const path = evidencePath(root, row.path)
        requireGate(
            fileHash(path) === row.sha256 && lstatSync(path).size === row.bytes,
            "EVIDENCE-HASH",
            row.path,
        )
    }
}
export function canonical(value) {
    if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]"
    if (value && typeof value === "object")
        return (
            "{" +
            Object.keys(value)
                .sort()
                .map(key => JSON.stringify(key) + ":" + canonical(value[key]))
                .join(",") +
            "}"
        )
    return JSON.stringify(value)
}
export function same(actual, expected, id, message) {
    requireGate(canonical(actual) === canonical(expected), id, message)
}
export function strictKeys(value, names, id) {
    requireGate(
        value && typeof value === "object" && !Array.isArray(value),
        id,
        "expected object",
    )
    exactRows(Object.keys(value), names, id)
}
