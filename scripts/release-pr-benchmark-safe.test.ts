/**
 * Runs the `publish` job's "Mark generated release pull request
 * benchmark-safe" script — extracted verbatim from ci.yaml — against a real
 * temporary Git repository with the GitHub API stubbed, so the guard's
 * decisions are executed rather than pattern-matched.
 */
import { afterEach, describe, expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

const ROOT = join(import.meta.dir, "..")
const STEP = "Mark generated release pull request benchmark-safe"
const RELEASE_BRANCH = "changeset-release/main"
const REPOSITORY = { owner: "eigilsagafos", repo: "valdres" }
const FULL_NAME = `${REPOSITORY.owner}/${REPOSITORY.repo}`

/** `Bun.YAML` postdates the pinned `@types/bun`; see scripts/verify.ts. */
const yaml = (Bun as unknown as { YAML: { parse(source: string): any } }).YAML

const stepScript: string = (() => {
    const workflow = yaml.parse(
        readFileSync(join(ROOT, ".github/workflows/ci.yaml"), "utf8"),
    )
    const step = workflow.jobs.publish.steps.find(
        (candidate: { name?: string }) => candidate.name === STEP,
    )
    return step.with.script
})()

const policy = readFileSync(
    join(ROOT, "scripts/publishable-packages.json"),
    "utf8",
)
const packageDirs: string[] = JSON.parse(policy)
const classifier = readFileSync(
    join(ROOT, "scripts/lib/release-metadata-scope.mjs"),
    "utf8",
)

const temps: string[] = []
afterEach(() => {
    for (const dir of temps.splice(0))
        rmSync(dir, { recursive: true, force: true })
})

function git(cwd: string, ...args: string[]): string {
    const result = spawnSync("git", args, { cwd, encoding: "utf8" })
    if (result.status !== 0) {
        throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`)
    }
    return result.stdout
}

function write(cwd: string, files: Record<string, string>) {
    for (const [path, content] of Object.entries(files)) {
        mkdirSync(dirname(join(cwd, path)), { recursive: true })
        writeFileSync(join(cwd, path), content)
    }
}

function commit(cwd: string, message: string): string {
    git(cwd, "add", "-A")
    git(cwd, "commit", "-q", "--allow-empty", "-m", message)
    return git(cwd, "rev-parse", "HEAD").trim()
}

const STATUS: Record<string, string> = {
    A: "added",
    M: "modified",
    D: "removed",
    R: "renamed",
}

/** The shape `pulls.listFiles` returns, computed from the real Git diff. */
function changedFiles(cwd: string, base: string, head: string) {
    const fields = git(cwd, "diff", "--name-status", "-M", "-z", base, head)
        .split("\0")
        .slice(0, -1)
    const files: Array<{
        status: string
        filename: string
        previous_filename?: string
    }> = []
    for (let i = 0; i < fields.length; ) {
        const status = fields[i++]
        if (status.startsWith("R")) {
            const previous_filename = fields[i++]
            files.push({
                status: "renamed",
                previous_filename,
                filename: fields[i++],
            })
        } else {
            files.push({ status: STATUS[status], filename: fields[i++] })
        }
    }
    return files
}

interface Scenario {
    /** Files committed on main; defaults to the checked-out policy + classifier. */
    main?: Record<string, string>
    /** Files the Changesets release commit writes. */
    release: Record<string, string>
    /** Renames the release commit performs. */
    renames?: Array<[string, string]>
    /** Uncommitted working-tree edits on the release checkout. */
    workingTree?: Record<string, string>
    headRepository?: string
}

async function runStep(scenario: Scenario) {
    const repo = mkdtempSync(join(tmpdir(), "release-guard-repo-"))
    const runnerTemp = mkdtempSync(join(tmpdir(), "release-guard-runner-"))
    temps.push(repo, runnerTemp)

    git(repo, "init", "-q", "-b", "main")
    git(repo, "config", "user.email", "test@example.com")
    git(repo, "config", "user.name", "test")
    git(repo, "config", "commit.gpgsign", "false")
    write(repo, {
        "bun.lock": "{}\n",
        "packages/valdres/src/index.ts": "export {}\n",
        ...(scenario.main ?? {
            "scripts/publishable-packages.json": policy,
            "scripts/lib/release-metadata-scope.mjs": classifier,
        }),
    })
    for (const [from] of scenario.renames ?? []) write(repo, { [from]: "x\n" })
    const trustedSha = commit(repo, "main")

    git(repo, "checkout", "-q", "-b", RELEASE_BRANCH)
    write(repo, scenario.release)
    for (const [from, to] of scenario.renames ?? []) {
        mkdirSync(dirname(join(repo, to)), { recursive: true })
        git(repo, "mv", from, to)
    }
    const releaseSha = commit(repo, "Version Packages (beta)")
    if (scenario.workingTree) write(repo, scenario.workingTree)

    const checks: Array<Record<string, unknown>> = []
    const listFiles = () => {
        throw new Error("listFiles must be called through paginate")
    }
    const github = {
        paginate: async (method: unknown, params: { pull_number: number }) => {
            expect(method).toBe(listFiles)
            expect(params.pull_number).toBe(406)
            return changedFiles(repo, trustedSha, releaseSha)
        },
        rest: {
            pulls: {
                get: async () => ({
                    data: {
                        state: "open",
                        base: { ref: "main", repo: { full_name: FULL_NAME } },
                        head: {
                            sha: releaseSha,
                            ref: RELEASE_BRANCH,
                            repo: {
                                full_name: scenario.headRepository ?? FULL_NAME,
                            },
                        },
                    },
                }),
                listFiles,
            },
            git: {
                getRef: async () => ({
                    data: { object: { type: "commit", sha: releaseSha } },
                }),
            },
            checks: {
                create: async (check: Record<string, unknown>) => {
                    checks.push(check)
                },
            },
        },
    }
    // @actions/exec rejects on a non-zero exit, like this stub.
    const exec = {
        getExecOutput: async (command: string, args: string[]) => {
            const result = spawnSync(command, args, {
                cwd: repo,
                encoding: "utf8",
            })
            if (result.status !== 0) {
                throw new Error(
                    `${command} failed with exit code ${result.status}`,
                )
            }
            return { exitCode: 0, stdout: result.stdout, stderr: result.stderr }
        },
    }
    const context = {
        repo: REPOSITORY,
        sha: trustedSha,
        runId: 1,
        serverUrl: "https://github.com",
    }

    const saved = { ...process.env }
    process.env.RELEASE_PR_NUMBER = "406"
    process.env.RUNNER_TEMP = runnerTemp
    const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor
    try {
        const run = new AsyncFunction(
            "require",
            "github",
            "context",
            "exec",
            stepScript,
        )
        const error = await run(
            createRequire(import.meta.url),
            github,
            context,
            exec,
        ).then(
            () => undefined,
            (caught: Error) => caught,
        )
        return { error, checks, releaseSha }
    } finally {
        process.env = saved
    }
}

const metadata = (dir: string) => ({
    [`${dir}/package.json`]: `{"name":"x","version":"1.0.0-beta.1"}\n`,
    [`${dir}/CHANGELOG.md`]: "# changelog\n",
})

describe("benchmark-safe release pull request step", () => {
    test("authorizes PR #406's shape: keyboard and core metadata", async () => {
        const { error, checks, releaseSha } = await runStep({
            release: {
                "bun.lock": '{"v":1}\n',
                ...metadata("packages/@valdres/browser-keyboard"),
                ...metadata("packages/valdres"),
            },
            renames: [
                [
                    ".changeset/store-sub-settle.md",
                    ".changeset/pre/store-sub-settle.md",
                ],
            ],
        })
        expect(error).toBeUndefined()
        expect(checks).toHaveLength(1)
        expect(checks[0]).toMatchObject({
            name: "benchmark_pr",
            head_sha: releaseSha,
            conclusion: "success",
        })
    })

    test("authorizes metadata for every publishable package", async () => {
        const { error, checks } = await runStep({
            release: Object.assign({}, ...packageDirs.map(metadata)),
        })
        expect(error).toBeUndefined()
        expect(checks).toHaveLength(1)
    })

    test.each([
        ["a runtime file", "packages/@valdres/browser-keyboard/src/index.ts"],
        ["a workflow", ".github/workflows/ci.yaml"],
        [
            "an unlisted package manifest",
            "packages/@valdres/browser-geolocation/package.json",
        ],
        ["the release policy", "scripts/publishable-packages.json"],
    ])("refuses %s", async (_, path) => {
        const { error, checks } = await runStep({
            release: { ...metadata("packages/valdres"), [path]: "changed\n" },
        })
        expect(error?.message).toBe(
            `Refusing benchmark check for non-release files: ${path}`,
        )
        expect(checks).toHaveLength(0)
    })

    test("refuses a disallowed rename source", async () => {
        const { error, checks } = await runStep({
            release: metadata("packages/valdres"),
            renames: [
                ["packages/valdres/src/store.ts", ".changeset/pre/store.md"],
            ],
        })
        expect(error?.message).toBe(
            "Refusing benchmark check for non-release files: packages/valdres/src/store.ts",
        )
        expect(checks).toHaveLength(0)
    })

    test("ignores a policy and classifier tampered on the release checkout", async () => {
        const { error, checks } = await runStep({
            release: metadata("packages/@valdres/browser-geolocation"),
            workingTree: {
                "scripts/publishable-packages.json": JSON.stringify([
                    ...packageDirs,
                    "packages/@valdres/browser-geolocation",
                ]),
                "scripts/lib/release-metadata-scope.mjs":
                    "export function assertGeneratedReleaseFiles() {}\n",
            },
        })
        expect(error?.message).toContain(
            "Refusing benchmark check for non-release files: packages/@valdres/browser-geolocation/",
        )
        expect(checks).toHaveLength(0)
    })

    test("uses the trusted revision's policy, not the current file", async () => {
        const { error, checks } = await runStep({
            main: {
                "scripts/publishable-packages.json": '["packages/valdres"]',
                "scripts/lib/release-metadata-scope.mjs": classifier,
            },
            release: metadata("packages/@valdres/browser-keyboard"),
        })
        expect(error?.message).toContain(
            "non-release files: packages/@valdres/browser-keyboard/",
        )
        expect(checks).toHaveLength(0)
    })

    test("fails closed when the trusted revision has no classifier", async () => {
        const { error, checks } = await runStep({
            main: { "scripts/publishable-packages.json": policy },
            release: metadata("packages/valdres"),
            workingTree: {
                "scripts/lib/release-metadata-scope.mjs": classifier,
            },
        })
        expect(error?.message).toContain("git failed")
        expect(checks).toHaveLength(0)
    })

    test("keeps refusing a release pull request from another repository", async () => {
        const { error, checks } = await runStep({
            release: metadata("packages/valdres"),
            headRepository: "someone/valdres",
        })
        expect(error?.message).toBe(
            "Changesets pull request identity is not trusted",
        )
        expect(checks).toHaveLength(0)
    })
})
