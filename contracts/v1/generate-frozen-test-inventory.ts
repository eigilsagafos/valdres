import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import {
    existsSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const SOURCE_REVISION = "c071cdaba26a2f30243d43516a199a94a9137c6e"
const RELEASE_REVISION = "6adb53a240a84fc90b8ad8dc2af77611e45dfd08"
const SOURCE_TREE = "2e521d12d483d1d59030f95cacac6a1f2801232d"
const TEST_TREE = "785381e6d0bf303ad8d67dd3ba2af1f58be2a121"
const TARBALL_SHA256 =
    "d98638aa0d8890d35f25b2a132fb7add0355206f925fcf2a4cfe0104a20cafa4"
const SOURCE_LOCKFILE_GIT_BLOB_SHA1 = "8684a8d328c8e0bfdeb9c7f6ccb849d9cd9ecc05"
const SOURCE_LOCKFILE_SHA256 =
    "c79a4fe44e6caa93c294744ba6ded67ccf2844286d5218e509cfa944f8b6a2d0"
const RUNNER_VERSION = "1.4.0"
const MINIMUM_ASSERTIONS = 328_000
const PACKAGE_VERSION = "1.0.0-beta.23"
const PACKAGE_ROOT = "packages/valdres"
const REGISTRY_TARBALL_URL =
    "https://registry.npmjs.org/valdres/-/valdres-1.0.0-beta.23.tgz"
const DEFAULT_TARBALL =
    ".context/valdres-bisect.eKj22u/1.0.0-beta.23/valdres-1.0.0-beta.23.tgz"
const ZERO_REGISTRATION_TEST_FILES = [
    "packages/valdres/src/lib/atomFamily.types.test.ts",
    "packages/valdres/src/lib/commitPlan.types.test.ts",
    "packages/valdres/src/lib/setAtom.types.test.ts",
    "packages/valdres/src/lib/transaction.types.test.ts",
] as const

interface Subject {
    readonly origin: "published-beta.23"
    readonly kind: "production-file" | "test-file" | "test-case"
    readonly path: string
    readonly testName?: string
}

interface InventoryEntry {
    readonly id: string
    readonly subject: Subject
    readonly evidence:
        | { readonly gitBlobSha1: string }
        | { readonly gitBlobSha1: string; readonly sourceLine: number }
}

interface RegisteredTest {
    readonly path: string
    readonly testName: string
    readonly sourceLine: number
}

interface GitBlob {
    readonly path: string
    readonly sha1: string
}

interface JunitSummary {
    readonly tests: number
    readonly assertions: number
    readonly failures: number
    readonly skipped: number
    readonly testFiles: readonly string[]
    readonly testCases: readonly RegisteredTest[]
}

interface TarballFetchResponse {
    readonly ok: boolean
    readonly status: number
    readonly statusText: string
    arrayBuffer(): Promise<ArrayBuffer>
}

type TarballFetcher = (url: string) => Promise<TarballFetchResponse>

const directory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(directory, "../..")
const inventoryPath = join(directory, "frozen-test-inventory.json")
const ledgerPath = join(directory, "test-dispositions.jsonl")

// These four stable review handles predate the mechanical inventory. The
// aliases change labels only: enumeration and subject coordinates still come
// exclusively from the immutable source tree and its JUnit registration run.
const reviewedIdAliases = new Map<string, string>([
    [
        coordinate({
            origin: "published-beta.23",
            kind: "test-case",
            path: "packages/valdres/test/asyncSelector.test.ts",
            testName:
                "async selectors > selector returning a Promise stores the Promise then resolves",
        }),
        "beta23.selector.promise-resolution",
    ],
    [
        coordinate({
            origin: "published-beta.23",
            kind: "test-case",
            path: "packages/valdres/src/lib/scope.test.ts",
            testName:
                "scope set pins even when value equals the inherited value > set to the inherited value still shadows; a later parent write does not leak",
        }),
        "beta23.scope.equal-value-pin",
    ],
    [
        coordinate({
            origin: "published-beta.23",
            kind: "test-case",
            path: "packages/valdres/src/lib/transaction.atomicScope.test.ts",
            testName:
                "cross-scope transactions are atomically observable > single scope > root subscriber never sees root=new while scope=old",
        }),
        "beta23.transaction.cross-scope-atomic-observation",
    ],
    [
        coordinate({
            origin: "published-beta.23",
            kind: "test-case",
            path: "packages/valdres/src/lib/setAtom.test.ts",
            testName:
                "setAtom > set with same value does not trigger selectors and subscribers to re-evalute",
        }),
        "beta23.atom.same-value-no-notification",
    ],
])

export function collectRegisteredTests(junit: string): JunitSummary {
    const rootAttributes = junit.match(/<testsuites\b([^>]*)>/u)?.[1]
    assert(rootAttributes !== undefined, "JUnit report has no testsuites root")
    const tests = integerAttribute(rootAttributes, "tests")
    const assertions = integerAttribute(rootAttributes, "assertions")
    const failures = integerAttribute(rootAttributes, "failures")
    const skipped = integerAttribute(rootAttributes, "skipped")
    assert(failures === 0, `beta.23 source run has ${failures} failures`)
    assert(skipped === 0, `beta.23 source run has ${skipped} skipped tests`)
    assert(
        assertions >= MINIMUM_ASSERTIONS,
        `beta.23 source run has ${assertions} assertions; expected at least ${MINIMUM_ASSERTIONS}`,
    )

    const suiteStack: Array<{ readonly name: string; readonly file: string }> =
        []
    const testFiles = new Set<string>()
    const testCases: RegisteredTest[] = []
    const tokenPattern =
        /<testsuite\b([^>]*)>|<\/testsuite>|<testcase\b([^>]*)\/>/gu
    for (const token of junit.matchAll(tokenPattern)) {
        if (token[1] !== undefined) {
            const name = requiredAttribute(token[1], "name")
            const file = requiredAttribute(token[1], "file")
            if (name === file && /\.test\.tsx?$/u.test(file)) {
                testFiles.add(`${PACKAGE_ROOT}/${file}`)
            }
            suiteStack.push({ name, file })
            continue
        }
        if (token[0] === "</testsuite>") {
            assert(suiteStack.pop() !== undefined, "unbalanced JUnit testsuite")
            continue
        }
        const attributes = token[2]
        assert(attributes !== undefined, "malformed JUnit testcase")
        const file = requiredAttribute(attributes, "file")
        const name = requiredAttribute(attributes, "name")
        const sourceLine = integerAttribute(attributes, "line")
        assert(
            sourceLine >= 1,
            `invalid JUnit source line for ${file}: ${name}`,
        )
        const fileSuite = suiteStack.findIndex(suite => suite.name === file)
        assert(fileSuite >= 0, `JUnit testcase has no file suite: ${file}`)
        const describeNames = suiteStack
            .slice(fileSuite + 1)
            .map(suite => suite.name)
        testCases.push({
            path: `${PACKAGE_ROOT}/${file}`,
            testName: [...describeNames, name].join(" > "),
            sourceLine,
        })
    }
    assert(suiteStack.length === 0, "unbalanced JUnit testsuite at EOF")
    assert(
        testCases.length === tests,
        `JUnit root reports ${tests} tests but ${testCases.length} cases were parsed`,
    )
    return {
        tests,
        assertions,
        failures,
        skipped,
        testFiles: [...testFiles],
        testCases,
    }
}

export function buildInventory(
    junit: string,
    tarballPath = resolve(repositoryRoot, DEFAULT_TARBALL),
): Readonly<{ readonly source: string; readonly inventory: any }> {
    assertFrozenProvenance(tarballPath)
    const junitSummary = collectRegisteredTests(junit)
    const sourceBlobs = listGitBlobs(SOURCE_REVISION, `${PACKAGE_ROOT}/src`)
    const testBlobs = listGitBlobs(SOURCE_REVISION, PACKAGE_ROOT).filter(blob =>
        /\.test\.tsx?$/u.test(blob.path),
    )
    const productionBlobs = sourceBlobs.filter(
        blob => /\.tsx?$/u.test(blob.path) && !/\.test\.tsx?$/u.test(blob.path),
    )
    const testBlobByPath = new Map(testBlobs.map(blob => [blob.path, blob]))
    const allTestPaths = new Set(testBlobs.map(blob => blob.path))
    const registeredTestPaths = new Set(junitSummary.testFiles)
    assertContainsOnly(registeredTestPaths, allTestPaths, "JUnit test file")
    assertExactSet(
        new Set(
            [...allTestPaths].filter(path => !registeredTestPaths.has(path)),
        ),
        new Set(ZERO_REGISTRATION_TEST_FILES),
        "zero-registration test file",
    )

    const entries: InventoryEntry[] = productionBlobs.map(blob => {
        const subject: Subject = {
            origin: "published-beta.23",
            kind: "production-file",
            path: blob.path,
        }
        return {
            id:
                reviewedIdAliases.get(coordinate(subject)) ??
                productionId(blob.path),
            subject,
            evidence: { gitBlobSha1: blob.sha1 },
        }
    })

    for (const path of ZERO_REGISTRATION_TEST_FILES) {
        const blob = testBlobByPath.get(path)
        assert(blob !== undefined, `zero-registration test is missing: ${path}`)
        const subject: Subject = {
            origin: "published-beta.23",
            kind: "test-file",
            path,
        }
        entries.push({
            id: testFileId(path),
            subject,
            evidence: { gitBlobSha1: blob.sha1 },
        })
    }

    const casesByLocation = new Map<string, RegisteredTest[]>()
    for (const testCase of junitSummary.testCases) {
        const location = `${testCase.path}:${testCase.sourceLine}`
        const atLocation = casesByLocation.get(location) ?? []
        atLocation.push(testCase)
        casesByLocation.set(location, atLocation)
    }
    for (const atLocation of casesByLocation.values()) {
        atLocation.sort((left, right) =>
            left.testName.localeCompare(right.testName),
        )
    }

    const duplicateSubjects = new Set<string>()
    for (const testCase of junitSummary.testCases) {
        const subject: Subject = {
            origin: "published-beta.23",
            kind: "test-case",
            path: testCase.path,
            testName: testCase.testName,
        }
        const subjectCoordinate = coordinate(subject)
        assert(
            !duplicateSubjects.has(subjectCoordinate),
            `duplicate registered test subject ${subjectCoordinate}`,
        )
        duplicateSubjects.add(subjectCoordinate)
        const blob = testBlobByPath.get(testCase.path)
        assert(
            blob !== undefined,
            `registered test is outside the frozen tree: ${testCase.path}`,
        )
        const sameLocation = casesByLocation.get(
            `${testCase.path}:${testCase.sourceLine}`,
        )!
        const instance = sameLocation.indexOf(testCase) + 1
        entries.push({
            id:
                reviewedIdAliases.get(subjectCoordinate) ??
                testId(testCase.path, testCase.sourceLine, instance),
            subject,
            evidence: {
                gitBlobSha1: blob.sha1,
                sourceLine: testCase.sourceLine,
            },
        })
    }
    entries.sort((left, right) => {
        const byPath = left.subject.path.localeCompare(right.subject.path)
        if (byPath !== 0) return byPath
        const leftName = left.subject.testName ?? ""
        const rightName = right.subject.testName ?? ""
        return leftName.localeCompare(rightName)
    })
    assertUnique(
        entries.map(entry => entry.id),
        "inventory ID",
    )

    const inventory = {
        $schema: "./schemas/frozen-test-inventory.schema.json",
        schemaVersion: 1,
        baseline: { package: "valdres", version: PACKAGE_VERSION },
        provenance: {
            sourceRevision: SOURCE_REVISION,
            releaseRevision: RELEASE_REVISION,
            sourceTrees: {
                source: SOURCE_TREE,
                tests: TEST_TREE,
            },
            publishedPackage: {
                npmSpec: `valdres@${PACKAGE_VERSION}`,
                tarballSha256: TARBALL_SHA256,
            },
            sourceLockfile: {
                path: "bun.lock",
                gitBlobSha1: SOURCE_LOCKFILE_GIT_BLOB_SHA1,
                sha256: SOURCE_LOCKFILE_SHA256,
            },
            testRegistration: {
                runner: "bun",
                runnerVersion: RUNNER_VERSION,
                selection: "packages/valdres/**/*.test.ts",
                files: testBlobs.length,
                registeredFiles: junitSummary.testFiles.length,
                zeroRegistrationFiles: ZERO_REGISTRATION_TEST_FILES,
                tests: junitSummary.tests,
                minimumAssertions: MINIMUM_ASSERTIONS,
                failures: junitSummary.failures,
                skipped: junitSummary.skipped,
            },
            generator: "contracts/v1/generate-frozen-test-inventory.ts",
        },
        counts: {
            productionFiles: productionBlobs.length,
            testFiles: ZERO_REGISTRATION_TEST_FILES.length,
            testCases: junitSummary.testCases.length,
            total: entries.length,
        },
        entries,
    }
    return {
        inventory,
        source: `${JSON.stringify(inventory, null, 2)}\n`,
    }
}

function captureJunit(): string {
    const captureDirectory = mkdtempSync(
        join(tmpdir(), "valdres-beta23-inventory-"),
    )
    const archivePath = join(captureDirectory, "source.tar")
    const reportPath = join(captureDirectory, "junit.xml")
    try {
        run("git", [
            "archive",
            "--format=tar",
            `--output=${archivePath}`,
            SOURCE_REVISION,
        ])
        run("tar", ["-xf", archivePath, "-C", captureDirectory])
        assert(
            sha256(readFileSync(join(captureDirectory, "bun.lock"))) ===
                SOURCE_LOCKFILE_SHA256,
            "archived beta.23 bun.lock differs before install",
        )
        run(
            process.execPath,
            ["install", "--frozen-lockfile", "--ignore-scripts"],
            captureDirectory,
        )
        assert(
            sha256(readFileSync(join(captureDirectory, "bun.lock"))) ===
                SOURCE_LOCKFILE_SHA256,
            "archived beta.23 bun.lock changed during frozen install",
        )
        run(
            process.execPath,
            ["test", "--reporter=junit", `--reporter-outfile=${reportPath}`],
            join(captureDirectory, PACKAGE_ROOT),
        )
        return readFileSync(reportPath, "utf8")
    } finally {
        rmSync(captureDirectory, { recursive: true, force: true })
    }
}

function assertFrozenProvenance(tarballPath: string): void {
    assert(
        gitText(["rev-parse", `${SOURCE_REVISION}:${PACKAGE_ROOT}/src`]) ===
            SOURCE_TREE,
        "source revision src tree differs from frozen provenance",
    )
    assert(
        gitText(["rev-parse", `${SOURCE_REVISION}:${PACKAGE_ROOT}/test`]) ===
            TEST_TREE,
        "source revision test tree differs from frozen provenance",
    )
    assert(
        gitText(["rev-parse", `${RELEASE_REVISION}:${PACKAGE_ROOT}/src`]) ===
            SOURCE_TREE,
        "release revision src tree differs from source revision",
    )
    assert(
        gitText(["rev-parse", `${RELEASE_REVISION}:${PACKAGE_ROOT}/test`]) ===
            TEST_TREE,
        "release revision test tree differs from source revision",
    )
    assert(
        gitText(["rev-parse", `${SOURCE_REVISION}:bun.lock`]) ===
            SOURCE_LOCKFILE_GIT_BLOB_SHA1,
        "source revision bun.lock blob differs from frozen provenance",
    )
    assert(
        sha256(runBuffer("git", ["show", `${SOURCE_REVISION}:bun.lock`])) ===
            SOURCE_LOCKFILE_SHA256,
        "source revision bun.lock bytes differ from frozen provenance",
    )
    assert(
        gitText(["show", `${SOURCE_REVISION}:.bun-version`]) === RUNNER_VERSION,
        "source revision Bun version differs from frozen provenance",
    )
    assert(
        bunVersion() === RUNNER_VERSION,
        `inventory regeneration requires Bun ${RUNNER_VERSION}`,
    )
    const releasePackage = JSON.parse(
        gitText(["show", `${RELEASE_REVISION}:${PACKAGE_ROOT}/package.json`]),
    ) as { readonly version?: unknown }
    assert(
        releasePackage.version === PACKAGE_VERSION,
        "release revision is not valdres@1.0.0-beta.23",
    )
    const tarball = readFileSync(tarballPath)
    assert(
        sha256(tarball) === TARBALL_SHA256,
        "published beta.23 tarball SHA-256 differs from frozen provenance",
    )
    const packedPackage = JSON.parse(
        runText("tar", ["-xOf", tarballPath, "package/package.json"]),
    ) as { readonly name?: unknown; readonly version?: unknown }
    assert(
        packedPackage.name === "valdres" &&
            packedPackage.version === PACKAGE_VERSION,
        "published tarball package identity differs from valdres@1.0.0-beta.23",
    )
}

function listGitBlobs(revision: string, path: string): readonly GitBlob[] {
    const output = runBuffer("git", [
        "ls-tree",
        "-r",
        "-z",
        revision,
        "--",
        path,
    ]).toString("utf8")
    const blobs: GitBlob[] = []
    for (const record of output.split("\0")) {
        if (record.length === 0) continue
        const match = record.match(/^[0-7]+ blob ([0-9a-f]{40})\t(.+)$/u)
        assert(match !== null, `unexpected git ls-tree record: ${record}`)
        blobs.push({ sha1: match[1]!, path: match[2]! })
    }
    return blobs
}

function productionId(path: string): string {
    return `beta23.production.${slug(path.slice(`${PACKAGE_ROOT}/src/`.length).replace(/\.tsx?$/u, ""))}`
}

function testId(path: string, line: number, instance: number): string {
    const relativePath = path
        .slice(`${PACKAGE_ROOT}/`.length)
        .replace(/\.test\.tsx?$/u, "")
    return `beta23.test.${slug(relativePath)}.l${line}.${String(instance).padStart(2, "0")}`
}

function testFileId(path: string): string {
    const relativePath = path
        .slice(`${PACKAGE_ROOT}/`.length)
        .replace(/\.test\.tsx?$/u, "")
    return `beta23.test-file.${slug(relativePath)}`
}

function slug(value: string): string {
    return value
        .replace(/([a-z0-9])([A-Z])/gu, "$1-$2")
        .toLowerCase()
        .replace(/[^a-z0-9]+/gu, ".")
        .replace(/^\.|\.$/gu, "")
}

function updateLedgerHeader(source: string): void {
    const records = readFileSync(ledgerPath, "utf8")
        .split(/\r?\n/u)
        .filter(line => line.trim().length > 0)
        .map(line => JSON.parse(line) as any)
    const header = records[0]
    assert(header?.recordType === "header", "ledger header must be first")
    const parsed = JSON.parse(source) as {
        readonly entries: readonly {
            readonly id: string
            readonly subject: Subject
        }[]
    }
    header.inventory = {
        status: "frozen",
        catalogPath: "contracts/v1/frozen-test-inventory.json",
        sha256: sha256(source),
        expectedDispositionIds: parsed.entries
            .filter(entry => entry.subject.kind !== "production-file")
            .map(entry => entry.id),
    }
    header.notes = [
        "The beta.23 production-file, zero-registration test-file, and registered test-case inventory is frozen from immutable source trees, its lockfile, and the published tarball.",
        "Every beta.23 test subject has a proposed A/B/C/D/E disposition; none of these proposed rows is approval or replacement-owner coverage.",
        "Production-file subjects belong to the separate production-source ledger, so this test ledger remains partial until its proposed rows are reviewed and approved.",
    ]
    writeFileSync(
        ledgerPath,
        `${records.map(record => JSON.stringify(record)).join("\n")}\n`,
    )
}

function checkLedgerHeader(source: string): void {
    const header = JSON.parse(
        readFileSync(ledgerPath, "utf8").split(/\r?\n/u)[0]!,
    ) as any
    const inventory = JSON.parse(source) as {
        readonly entries: readonly {
            readonly id: string
            readonly subject: Subject
        }[]
    }
    assert(
        header.inventory?.status === "frozen",
        "ledger inventory is not frozen",
    )
    assert(
        header.inventory.catalogPath ===
            "contracts/v1/frozen-test-inventory.json",
        "ledger inventory path differs",
    )
    assert(
        header.inventory.sha256 === sha256(source),
        "ledger inventory SHA-256 differs",
    )
    assertExactSet(
        new Set(header.inventory.expectedDispositionIds),
        new Set(
            inventory.entries
                .filter(entry => entry.subject.kind !== "production-file")
                .map(entry => entry.id),
        ),
        "ledger expected test-subject ID",
    )
}

function coordinate(subject: Subject): string {
    return JSON.stringify([
        subject.origin,
        subject.kind,
        subject.path,
        subject.testName ?? null,
    ])
}

function requiredAttribute(attributes: string, name: string): string {
    const value = xmlAttribute(attributes, name)
    assert(value !== null, `JUnit attribute ${name} is missing`)
    return value
}

function integerAttribute(attributes: string, name: string): number {
    const value = Number(requiredAttribute(attributes, name))
    assert(Number.isSafeInteger(value) && value >= 0, `invalid JUnit ${name}`)
    return value
}

function xmlAttribute(attributes: string, name: string): string | null {
    const value = attributes.match(
        new RegExp(`(?:^|\\s)${name}="([^"]*)"`, "u"),
    )?.[1]
    return value === undefined ? null : decodeXml(value)
}

function decodeXml(value: string): string {
    return value.replace(
        /&(?:#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos);/giu,
        entity => {
            if (entity.startsWith("&#x")) {
                return String.fromCodePoint(
                    Number.parseInt(entity.slice(3, -1), 16),
                )
            }
            if (entity.startsWith("&#")) {
                return String.fromCodePoint(
                    Number.parseInt(entity.slice(2, -1), 10),
                )
            }
            return (
                {
                    "&amp;": "&",
                    "&lt;": "<",
                    "&gt;": ">",
                    "&quot;": '"',
                    "&apos;": "'",
                } as const
            )[entity.toLowerCase() as "&amp;"]
        },
    )
}

function bunVersion(): string {
    return runText(process.execPath, ["--version"])
}

function sha256(value: string | Buffer): string {
    return createHash("sha256")
        .update(typeof value === "string" ? value : Uint8Array.from(value))
        .digest("hex")
}

function gitText(args: readonly string[]): string {
    return runText("git", args)
}

function runText(
    command: string,
    args: readonly string[],
    cwd = repositoryRoot,
): string {
    return runBuffer(command, args, cwd).toString("utf8").trim()
}

function runBuffer(
    command: string,
    args: readonly string[],
    cwd = repositoryRoot,
): Buffer {
    const result = spawnSync(command, args, {
        cwd,
        encoding: "buffer",
        maxBuffer: 128 * 1024 * 1024,
    })
    assert(
        result.error === undefined && result.status === 0,
        `${command} ${args.join(" ")} failed:\n${result.stderr?.toString("utf8") ?? ""}`,
    )
    return result.stdout
}

function run(
    command: string,
    args: readonly string[],
    cwd = repositoryRoot,
): void {
    const result = spawnSync(command, args, {
        cwd,
        stdio: ["ignore", "ignore", "pipe"],
        maxBuffer: 128 * 1024 * 1024,
    })
    assert(
        result.error === undefined && result.status === 0,
        `${command} ${args.join(" ")} failed:\n${result.stderr?.toString("utf8") ?? ""}`,
    )
}

function assertExactSet(
    actual: ReadonlySet<string>,
    expected: ReadonlySet<string>,
    label: string,
): void {
    const missing = [...expected].filter(value => !actual.has(value))
    const unexpected = [...actual].filter(value => !expected.has(value))
    assert(
        missing.length === 0 && unexpected.length === 0,
        `${label} differs; missing: ${missing.join(", ") || "none"}; unexpected: ${unexpected.join(", ") || "none"}`,
    )
}

function assertContainsOnly(
    actual: ReadonlySet<string>,
    allowed: ReadonlySet<string>,
    label: string,
): void {
    const unexpected = [...actual].filter(value => !allowed.has(value))
    assert(
        unexpected.length === 0,
        `${label} contains unexpected values: ${unexpected.join(", ")}`,
    )
}

function assertUnique(values: readonly string[], label: string): void {
    const seen = new Set<string>()
    for (const value of values) {
        assert(!seen.has(value), `duplicate ${label} ${value}`)
        seen.add(value)
    }
}

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message)
}

export async function acquirePublishedTarball(
    localPath: string,
    downloadDirectory: string,
    fetcher: TarballFetcher = url => fetch(url),
): Promise<string> {
    if (existsSync(localPath)) return localPath

    const response = await fetcher(REGISTRY_TARBALL_URL)
    assert(
        response.ok,
        `fetch ${REGISTRY_TARBALL_URL} failed: ${response.status} ${response.statusText}`,
    )
    const downloadedPath = join(
        downloadDirectory,
        `valdres-${PACKAGE_VERSION}.tgz`,
    )
    writeFileSync(downloadedPath, new Uint8Array(await response.arrayBuffer()))
    return downloadedPath
}

async function main(): Promise<void> {
    const args = process.argv.slice(2)
    const write = args.includes("--write")
    const check = args.includes("--check")
    assert(write !== check, "choose exactly one of --write or --check")
    const junitArgument = argumentValue(args, "--junit")
    const tarballArgument = argumentValue(args, "--tarball")
    const junit =
        junitArgument === null
            ? captureJunit()
            : readFileSync(resolve(repositoryRoot, junitArgument), "utf8")
    let downloadDirectory: string | null = null
    try {
        let tarball: string
        if (tarballArgument !== null) {
            tarball = resolve(repositoryRoot, tarballArgument)
        } else {
            const localTarball = resolve(repositoryRoot, DEFAULT_TARBALL)
            if (!existsSync(localTarball)) {
                downloadDirectory = mkdtempSync(
                    join(tmpdir(), "valdres-beta23-tarball-"),
                )
            }
            tarball = await acquirePublishedTarball(
                localTarball,
                downloadDirectory ?? tmpdir(),
            )
        }
        const { source, inventory } = buildInventory(junit, tarball)
        if (write) {
            writeFileSync(inventoryPath, source)
            updateLedgerHeader(source)
        } else {
            assert(
                readFileSync(inventoryPath, "utf8") === source,
                "frozen inventory differs from regenerated inventory",
            )
            checkLedgerHeader(source)
        }
        console.log(
            `beta.23 inventory ${write ? "written" : "verified"}: ` +
                `${inventory.counts.productionFiles} production files + ` +
                `${inventory.counts.testFiles} zero-registration test files + ` +
                `${inventory.counts.testCases} test cases = ${inventory.counts.total}`,
        )
    } finally {
        if (downloadDirectory !== null) {
            rmSync(downloadDirectory, { recursive: true, force: true })
        }
    }
}

function argumentValue(args: readonly string[], name: string): string | null {
    const index = args.indexOf(name)
    if (index < 0) return null
    const value = args[index + 1]
    assert(
        value !== undefined && !value.startsWith("--"),
        `${name} requires a path`,
    )
    return value
}

if (import.meta.main) await main()
