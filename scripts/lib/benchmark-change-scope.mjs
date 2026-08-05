/**
 * Decide whether a pull request can safely skip runtime benchmarks.
 *
 * Input is the byte stream from `git diff --name-status -z`, not line-oriented
 * text. The classifier skips only A/M/D entries whose paths are all clearly
 * documentation, Changeset metadata, or ordinary non-performance tests. Every
 * ambiguity — malformed input, unknown status/path, rename, or copy — runs.
 */

const textDecoder = new TextDecoder("utf-8", { fatal: true })

function result(runBenchmarks, reason) {
    return { runBenchmarks, reason }
}

function isAlwaysRelevant(path) {
    const lower = path.toLowerCase()
    const basename = lower.slice(lower.lastIndexOf("/") + 1)

    return (
        lower === "bun.lock" ||
        basename === "package.json" ||
        /(^|\/)packages\/valdres\/test\/performance\//.test(lower) ||
        /\.(?:bench|timing)\.[^/]+$/.test(lower) ||
        /(^|\/)vitest\.[^/]*(?:bench|benchmark)[^/]*\.config\.[^/]+$/.test(
            lower,
        ) ||
        /^scripts\/bench/.test(lower) ||
        /^\.github\/workflows\/bencher(?:-|\.)/.test(lower)
    )
}

function isClearlyIrrelevant(path) {
    const lower = path.toLowerCase()
    const basename = lower.slice(lower.lastIndexOf("/") + 1)

    if (lower === "bun.lock" || basename === "package.json") return false
    if (/^\.changeset\/[^/]+\.md$/.test(lower)) return true
    if (/\.(?:md|mdx)$/.test(lower)) return true
    if (isAlwaysRelevant(path)) return false
    if (/^readme/.test(basename)) return true
    if (lower.startsWith("docs/")) return true

    if (/\.(?:test|spec)\.[^/]+$/.test(lower)) return true
    if (/(^|\/)__tests__(\/|$)/.test(lower)) return true
    if (/(^|\/)__snapshots__(\/|$)/.test(lower)) return true
    if (/\.snap$/.test(lower)) return true
    if (/(^|\/)(?:test|tests|test-d|type-tests?)(\/|$)/.test(lower)) {
        return true
    }

    return false
}

function toBytes(input) {
    if (typeof input === "string") return new TextEncoder().encode(input)
    if (input instanceof Uint8Array) return input
    return new Uint8Array(input)
}

export function classifyBenchmarkChanges(input, options = {}) {
    if (options.force === true) {
        return result(true, "run-benchmarks label forces measurement")
    }

    let bytes
    try {
        bytes = toBytes(input)
    } catch {
        return result(true, "unreadable diff input")
    }
    if (bytes.length === 0) return result(true, "empty diff input")
    if (bytes[bytes.length - 1] !== 0) {
        return result(true, "diff input is not NUL-terminated")
    }

    let fields
    try {
        fields = textDecoder.decode(bytes).split("\0")
    } catch {
        return result(true, "diff input is not valid UTF-8")
    }
    if (fields.pop() !== "") return result(true, "malformed diff terminator")

    const paths = []
    for (let index = 0; index < fields.length; ) {
        const status = fields[index++]
        if (/^[RC]\d{1,3}$/.test(status)) {
            const from = fields[index++]
            const to = fields[index++]
            if (!from || !to) return result(true, "malformed rename or copy")
            return result(
                true,
                `${status[0] === "R" ? "rename" : "copy"} entry`,
            )
        }
        if (!/^[AMD]$/.test(status)) {
            return result(true, `unsupported or malformed status: ${status}`)
        }

        const path = fields[index++]
        if (!path) return result(true, "missing changed path")
        paths.push(path)
    }

    if (paths.length === 0) return result(true, "diff contains no paths")
    const relevantPath = paths.find(path => !isClearlyIrrelevant(path))
    if (relevantPath !== undefined) {
        return result(true, `runtime-relevant or unknown path: ${relevantPath}`)
    }
    return result(false, "all changed paths are clearly non-runtime")
}

if (import.meta.main) {
    const chunks = []
    for await (const chunk of process.stdin) chunks.push(chunk)
    const input = Buffer.concat(chunks)
    const decision = classifyBenchmarkChanges(input, {
        force: process.env.BENCH_FORCE_RUN === "true",
    })
    process.stderr.write(`${decision.reason}\n`)
    process.stdout.write(decision.runBenchmarks ? "true\n" : "false\n")
}
