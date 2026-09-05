import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { execFileSync } from "node:child_process"
import Ajv2020 from "ajv/dist/2020.js"
import ts from "typescript"

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
export const DIRECTORY = "packages/valdres/test/selector-kernel-tournament"
export const SPEC_COMMIT = "20dddc5c307a1213f3888ab0dabc60a59a165b36"
export const json = path => JSON.parse(readFileSync(path, "utf8"))
export const sha256 = bytes => createHash("sha256").update(bytes).digest("hex")
export const fileHash = path => sha256(readFileSync(path))
export const git = (args, root = ROOT) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim()
import { requireGate } from "./gate.mjs"
export { requireGate } from "./gate.mjs"
export const manifest = json(
    resolve(ROOT, DIRECTORY, "fixture-manifest.v3.json"),
)
export const reportSchema = json(
    resolve(ROOT, DIRECTORY, "candidate-report.schema.json"),
)
const ajv = new Ajv2020({
    strict: true,
    allErrors: false,
    strictRequired: false,
})
ajv.addFormat("date-time", {
    type: "string",
    validate: value =>
        /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(
            value,
        ) && Number.isFinite(Date.parse(value)),
})
const validateManifest = ajv.compile(
    json(resolve(ROOT, DIRECTORY, "fixture-manifest.schema.json")),
)
const validateReport = ajv.compile(reportSchema)
export function schemaCheck(value, kind = "report") {
    const validate = kind === "manifest" ? validateManifest : validateReport
    requireGate(
        validate(value),
        "INPUT-SCHEMA",
        ajv.errorsText(validate.errors),
    )
}
export function uniqueRows(rows, key, id) {
    const keys = rows.map(key)
    requireGate(new Set(keys).size === keys.length, id, "duplicate row")
    return new Set(keys)
}
export function exactRows(actual, expected, id) {
    const found = uniqueRows(actual, value => value, id)
    const wanted = new Set(expected)
    for (const key of found)
        requireGate(wanted.has(key), id, `unknown row ${key}`)
    for (const key of wanted)
        requireGate(found.has(key), id, `missing row ${key}`)
}
export function assertClean(root = ROOT) {
    requireGate(
        git(["status", "--porcelain=v1", "--untracked-files=all"], root) === "",
        "PROVENANCE-DIRTY",
        root,
    )
}
export function assertControl(tree) {
    requireGate(
        tree === manifest.control.runtimeTree,
        "INPUT-CONTROL-TREE",
        tree,
    )
}
export function checkInputs(root = ROOT, input = manifest) {
    schemaCheck(input, "manifest")
    requireGate(
        fileHash(resolve(root, input.spec.path)) === input.spec.sha256,
        "INPUT-SPEC-HASH",
        input.spec.path,
    )
    for (const item of input.frozenInputs) {
        requireGate(
            fileHash(resolve(root, item.path)) === item.sha256,
            "INPUT-FROZEN-HASH",
            item.path,
        )
    }
    assertControl(
        git(
            ["rev-parse", `${input.control.gitSha}:packages/valdres/src`],
            root,
        ),
    )
    requireGate(
        git(["rev-parse", `${input.control.tag}^{commit}`], root) ===
            input.control.gitSha,
        "INPUT-CONTROL-COMMIT",
        input.control.tag,
    )
    git(
        [
            "merge-base",
            "--is-ancestor",
            input.productLanes.family.mergeCommit,
            input.control.gitSha,
        ],
        root,
    )
    git(
        ["merge-base", "--is-ancestor", input.control.gitSha, SPEC_COMMIT],
        root,
    )
    verifyMemorySource(
        readFileSync(
            resolve(root, input.memoryScenarios[0].sourceTest),
            "utf8",
        ),
        input,
    )
    const size = json(resolve(root, input.stages.size.baselineFile))
    requireGate(
        size.packed.gzip === input.stages.size.controlPackedGzipBytes &&
            Object.entries(size.distFiles).some(
                ([name, metric]) =>
                    /^chunk-.*\.js$/.test(name) &&
                    metric.gzip ===
                        input.stages.size.controlRootSharedGzipBytes,
            ),
        "INPUT-SIZE-BASELINE",
        "root or packed metric mismatch",
    )
    return {
        specGitSha: SPEC_COMMIT,
        specSha256: input.spec.sha256,
        manifestSha256: fileHash(
            resolve(root, DIRECTORY, "fixture-manifest.v3.json"),
        ),
        reportSchemaSha256: fileHash(
            resolve(root, DIRECTORY, "candidate-report.schema.json"),
        ),
    }
}

// Parse only literal arithmetic from the frozen source; never evaluate source
// code while checking the authority of the manifest.
export function verifyMemorySource(source, input = manifest) {
    const ast = ts.createSourceFile(
        "architecture.memory.ts",
        source,
        ts.ScriptTarget.Latest,
        true,
    )
    function literal(node) {
        if (ts.isNumericLiteral(node)) return Number(node.text)
        if (ts.isStringLiteral(node)) return node.text
        if (
            ts.isBinaryExpression(node) &&
            node.operatorToken.kind === ts.SyntaxKind.AsteriskToken
        )
            return literal(node.left) * literal(node.right)
        if (ts.isObjectLiteralExpression(node))
            return Object.fromEntries(
                node.properties.map(property => {
                    requireGate(
                        ts.isPropertyAssignment(property),
                        "INPUT-MEMORY-SOURCE",
                        "nonliteral limit",
                    )
                    return [property.name.text, literal(property.initializer)]
                }),
            )
        throw new Error("INPUT-MEMORY-SOURCE: nonliteral limit")
    }
    let limits
    const cases = new Map()
    function visit(node) {
        if (
            ts.isVariableDeclaration(node) &&
            node.name.getText(ast) === "limits"
        )
            limits = literal(node.initializer)
        if (
            ts.isCallExpression(node) &&
            node.expression.getText(ast) === "test" &&
            ts.isStringLiteral(node.arguments[0])
        )
            cases.set(node.arguments[0].text, node)
        ts.forEachChild(node, visit)
    }
    visit(ast)
    exactRows(
        Object.keys(limits ?? {}),
        input.sourceMemoryScenarios.map(row => row.name),
        "INPUT-MEMORY-SOURCE",
    )
    for (const scenario of input.sourceMemoryScenarios) {
        const node = cases.get(scenario.name)
        requireGate(node, "INPUT-MEMORY-SOURCE", scenario.name)
        const dimensions = []
        function dimensionsIn(child) {
            if (
                ts.isPropertyAssignment(child) &&
                child.name.getText(ast) === "length" &&
                ts.isNumericLiteral(child.initializer)
            )
                dimensions.push(Number(child.initializer.text))
            if (
                ts.isVariableDeclaration(child) &&
                child.name.getText(ast) === "depth" &&
                ts.isNumericLiteral(child.initializer)
            )
                dimensions.push(Number(child.initializer.text))
            ts.forEachChild(child, dimensionsIn)
        }
        dimensionsIn(node)
        requireGate(
            dimensions.length === 1 && dimensions[0] === scenario.units,
            "INPUT-MEMORY-UNITS",
            scenario.id,
        )
        for (const runtime of scenario.runtimes) {
            const actual = limits[scenario.name][runtime]
            const expected = scenario.absoluteCeilings[runtime]
            requireGate(
                actual.retainedBytesPerUnit === expected.retainedBytesPerUnit &&
                    actual.releasedBytes === expected.releasedResidualBytes,
                "INPUT-MEMORY-CEILING",
                `${scenario.id}/${runtime}`,
            )
        }
    }
}

// Freeze all neutral runner inputs plus family-owned paths. Candidate-local
// adapters belong outside these directories; this is not a production seam.
export function protectedPaths(root = ROOT, commit) {
    const tracked = git(
        commit ? ["ls-tree", "-r", "--name-only", commit] : ["ls-files"],
        root,
    )
        .split("\n")
        .filter(Boolean)
    const prefixes = [
        DIRECTORY + "/",
        "scripts/selector-kernel-tournament/",
        "packages/valdres/test/utils/",
        "packages/valdres/test/performance/",
        "packages/valdres/test/v1-model/",
        "packages/valdres/test/oracle/",
    ]
    return [
        ...new Set([
            ...tracked.filter(
                path =>
                    prefixes.some(prefix => path.startsWith(prefix)) ||
                    /^scripts\/lib\/(?:paired-decision|robust-estimators|read-bench-results)/.test(
                        path,
                    ),
            ),
            ...manifest.frozenInputs.map(item => item.path),
            ...manifest.productLanes.family.protectedPaths,
            manifest.spec.path,
            "packages/valdres/build.ts",
            "bun.lock",
        ]),
    ].sort()
}
export function protectedSnapshot(root = ROOT, commit) {
    const files = protectedPaths(root, commit).map(path => ({
        path,
        sha256: commit
            ? sha256(
                  execFileSync("git", ["show", `${commit}:${path}`], {
                      cwd: root,
                  }),
              )
            : fileHash(resolve(root, path)),
    }))
    return { files, sha256: sha256(JSON.stringify(files)) }
}
export function verifyProtected(root, foundation) {
    const expected = protectedSnapshot(ROOT, foundation)
    exactRows(
        protectedPaths(root),
        expected.files.map(item => item.path),
        "PROVENANCE-PROTECTED-PATH",
    )
    for (const item of expected.files)
        requireGate(
            fileHash(resolve(root, item.path)) === item.sha256,
            "PROVENANCE-PROTECTED-PATH",
            item.path,
        )
    return expected
}

export function validateInventoryRows(report) {
    const stage = report.candidate.stage === "C" ? "C" : "A"
    requireGate(
        manifest.implementations.some(
            row => row.kind === "candidate" && row.id === report.candidate.id,
        ),
        "REPORT-CANDIDATE",
        report.candidate.id,
    )
    const semantic = manifest.semanticCases
        .filter(row => row.requiredAt.includes(stage))
        .flatMap(row =>
            manifest.stages[stage].semanticRuntimes.map(
                runtime => `${row.id}/${runtime}`,
            ),
        )
    exactRows(
        report.semanticCases.map(row => `${row.id}/${row.runtime}`),
        semantic,
        "REPORT-SEMANTIC-ROWS",
    )
    const expected = manifest.performanceWorkloads
        .filter(row => row.requiredAt.includes(stage))
        .flatMap(row => row.runtimes.map(runtime => `${row.id}/${runtime}`))
    exactRows(
        report.workloads
            .filter(
                row =>
                    row.baselineId === "beta36-control" &&
                    row.runtime !== "chrome",
            )
            .map(row => `${row.id}/${row.runtime}`),
        expected,
        "REPORT-TIMING-ROWS",
    )
    uniqueRows(
        report.workloads,
        row => `${row.id}/${row.runtime}/${row.baselineId}`,
        "REPORT-TIMING-ROWS",
    )
    const intended = uniqueRows(
        report.candidate.intendedWorkloads,
        id => id,
        "REPORT-INTENT",
    )
    requireGate(
        intended.size >= 1 && intended.size <= 3,
        "REPORT-INTENT",
        "requires one to three workload IDs",
    )
    for (const id of intended)
        requireGate(
            manifest.performanceWorkloads.some(
                row => row.id === id && row.requiredAt.includes(stage),
            ),
            "REPORT-INTENT",
            `unknown or unavailable workload ${id}`,
        )
    for (const row of report.workloads) {
        const workload = manifest.performanceWorkloads.find(
            item => item.id === row.id,
        )
        const external = manifest.shiftxWorkloads.some(
            item => item.id === row.id,
        )
        requireGate(
            workload
                ? workload.runtimes.includes(row.runtime)
                : external &&
                      row.runtime === "chrome" &&
                      ["shiftx", "integration"].includes(
                          report.candidate.stage,
                      ),
            "REPORT-TIMING-ID",
            row.id,
        )
        if (row.baselineId === "pre28-claim") {
            requireGate(
                external &&
                    report.comparisonBaselines.pre28Claim !== null &&
                    report.gates.shiftx.status === "pass",
                "REPORT-PRE28-AUTH",
                row.id,
            )
            requireGate(
                !row.protected &&
                    !row.intended &&
                    row.decisions.protectedNonRegression === null &&
                    row.decisions.intendedWin === null &&
                    row.decisions.pre28Claim !== null,
                "REPORT-TEST-FAMILY",
                row.id,
            )
        } else {
            requireGate(
                row.protected === (workload?.protected ?? true) &&
                    row.intended === intended.has(row.id),
                "REPORT-TEST-FAMILY",
                row.id,
            )
            requireGate(
                row.decisions.pre28Claim === null &&
                    (row.decisions.protectedNonRegression !== null) ===
                        (stage === "A" && row.protected) &&
                    (row.decisions.intendedWin !== null) ===
                        (stage === "A" && row.intended),
                "REPORT-TEST-FAMILY",
                row.id,
            )
        }
    }
    if (stage === "A") {
        exactRows(
            report.resources.memory.map(row => `${row.id}/${row.runtime}`),
            manifest.memoryScenarios.flatMap(row =>
                row.runtimes.map(runtime => `${row.id}/${runtime}`),
            ),
            "REPORT-MEMORY-ROWS",
        )
    }
    uniqueRows(
        report.resources.memory,
        row => `${row.id}/${row.runtime}`,
        "REPORT-MEMORY-ROWS",
    )
    for (const row of report.resources.memory) {
        const scenario = manifest.memoryScenarios.find(
            item => item.id === row.id,
        )
        const ceiling = scenario?.releaseCeilings[row.runtime]
        requireGate(
            ceiling &&
                row.unitCount === scenario.units &&
                row.domain === "packed-paired" &&
                row.releasedResidualBytesCeiling === ceiling,
            "REPORT-MEMORY-CEILING",
            row.id,
        )
    }
}

export function verifyClaimIdentity(identity, tarball) {
    const pinned = manifest.historicalReferences.find(
        row => row.id === "pre28-claim",
    )
    for (const key of [
        "registryIntegrity",
        "registryShasum",
        "registryTarballSha256",
        "registryGitHead",
        "packageSpec",
        "packageVersion",
    ])
        requireGate(identity[key] === pinned[key], "INPUT-PRE28-IDENTITY", key)
    const bytes = readFileSync(tarball)
    requireGate(
        sha256(bytes) === pinned.registryTarballSha256 &&
            createHash("sha1").update(bytes).digest("hex") ===
                pinned.registryShasum &&
            `sha512-${createHash("sha512").update(bytes).digest("base64")}` ===
                pinned.registryIntegrity,
        "INPUT-PRE28-TARBALL",
        tarball,
    )
}

if (import.meta.main) {
    const command = process.argv[2]
    if (command === "check") console.log(JSON.stringify(checkInputs(), null, 2))
    else if (command === "protected")
        console.log(JSON.stringify(protectedSnapshot(), null, 2))
    else
        throw new Error(
            "usage: bun scripts/selector-kernel-tournament/inputs.mjs check|protected",
        )
}
