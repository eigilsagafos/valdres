/**
 * JUnit coverage gate — every package with a runnable `test` script must
 * actually emit a JUnit report.
 *
 * `bun run test:ci` can exit 0 while a package produces no `junit.xml` at all:
 * a package whose test script does not understand the reporter flags, or one
 * that crashes before the reporter writes. CI has always caught that, but only
 * inside the `Test Report` step — an `actions/github-script` action calling
 * `core.setFailed`, which no local command could run. So this gate was
 * invisible to `bun run verify`, which is exactly the class of hole verify
 * exists to close. It lives here now, runs as an ordinary shell step in CI, and
 * `verify` picks it up from the workflow like any other step.
 *
 * A package opts out with the exact placeholder `"test": "echo 'no tests'"`.
 * Expectations also include packages that had a test script on the base branch,
 * so deleting one cannot silently remove coverage.
 *
 *   bun run scripts/check-junit-coverage.ts           # the gate; exits 1 on a gap
 *   bun run scripts/check-junit-coverage.ts --json    # pure query, always exits 0
 *   bun run scripts/check-junit-coverage.ts --base=<ref>
 *
 * This only means anything against freshly written reports. `junit*.xml` is
 * gitignored and would otherwise survive between local runs, letting a report
 * from an hour ago satisfy the gate for a package that has since stopped
 * emitting one — green locally, red on CI's clean checkout. The workflow's
 * "Clear stale JUnit reports" step deletes them immediately before `test:ci`,
 * so CI and `bun run verify` both scan only what this run produced.
 */
import { join } from "node:path"

const root = join(import.meta.dir, "..")

/** The one opt-out spelling. Anything else in `scripts.test` is a real suite. */
const NO_TESTS_PLACEHOLDER = /^echo\s+(['"])no tests\1$/

const scan = async (pattern: string) => {
    const found: string[] = []
    for await (const file of new Bun.Glob(pattern).scan({ cwd: root })) {
        if (file.split("/").includes("node_modules")) continue
        found.push(file)
    }
    return found.sort()
}

const git = (args: string[]) => {
    const proc = Bun.spawnSync(["git", ...args], { cwd: root })
    return proc.exitCode === 0 ? proc.stdout.toString() : null
}

/** `packages/@valdres/foo/package.json` -> `@valdres/foo`, matching the keys
 *  the CI reporter builds from JUnit paths. */
const packageKey = (path: string) =>
    path
        .replace(/^packages\//, "")
        .replace(/\/(package\.json|junit.*\.xml)$/, "")

const expectsReport = (manifestSource: string) => {
    try {
        const testScript = JSON.parse(manifestSource).scripts?.test
        return (
            typeof testScript === "string" &&
            !NO_TESTS_PLACEHOLDER.test(testScript)
        )
    } catch {
        return false // unreadable manifest is the reporter's problem, not ours
    }
}

export const collectCoverage = async (base: string) => {
    const manifests = await scan("packages/**/package.json")
    const current = new Set(manifests)
    const expected = new Set<string>()

    for (const manifest of manifests)
        if (expectsReport(await Bun.file(join(root, manifest)).text()))
            expected.add(packageKey(manifest))

    // Include the base branch's test-bearing packages so deleting a test
    // script cannot quietly drop a package from the expected set. Restricted
    // to manifests that still exist, so a package deleted outright is not
    // demanded back.
    const baseResolved =
        git(["rev-parse", "--verify", "--quiet", base]) !== null
    if (baseResolved)
        for (const manifest of (
            git(["ls-tree", "-r", "--name-only", base, "--", "packages"]) ?? ""
        )
            .split("\n")
            .filter(
                path => path.endsWith("/package.json") && current.has(path),
            )) {
            const source = git(["show", `${base}:${manifest}`])
            if (source !== null && expectsReport(source))
                expected.add(packageKey(manifest))
        }

    const reports = await scan("packages/**/junit*.xml")
    const found = new Set(reports.map(packageKey))
    const missing = [...expected].filter(pkg => !found.has(pkg)).sort()

    return {
        base,
        baseResolved,
        expected: [...expected].sort(),
        found: [...found].sort(),
        missing,
        reportCount: reports.length,
    }
}

if (import.meta.main) {
    const args = process.argv.slice(2)
    const base =
        args.find(arg => arg.startsWith("--base="))?.slice("--base=".length) ??
        "origin/main"
    const coverage = await collectCoverage(base)

    if (args.includes("--json")) {
        console.log(JSON.stringify(coverage))
        process.exit(0)
    }

    // An unresolvable base silently drops the base-branch expectations, which
    // is the difference between catching and missing "this PR replaced a real
    // test script with the placeholder": CI's full-history checkout still
    // expects that package to report, a base-less local run does not. Fail
    // closed rather than quietly weaken the gate. Nothing is lost by being
    // strict — verify's `Require changeset` step already needs origin/main, so
    // a clone without it never reaches this point anyway.
    if (!coverage.baseResolved) {
        console.error(
            `::error::Base ref \`${coverage.base}\` could not be resolved, so packages that had a\n` +
                `test script on the base branch cannot be included in the expectation set.\n\n` +
                `    git fetch origin main:refs/remotes/origin/main\n` +
                `    bun run scripts/check-junit-coverage.ts --base=<ref>   # or point somewhere else`,
        )
        process.exit(1)
    }
    // Guard the guard: if the scan stops finding test-bearing packages at all,
    // fail rather than pass an empty expectation set.
    if (coverage.expected.length === 0) {
        console.error(
            "::error::No packages with a test script were found — the JUnit coverage scan is broken.",
        )
        process.exit(1)
    }
    if (coverage.reportCount === 0) {
        console.error(
            "::error::No JUnit reports were produced at all. Tests may have crashed before completing.",
        )
        process.exit(1)
    }
    if (coverage.missing.length > 0) {
        console.error(
            `::error::${coverage.missing.length} package(s) with a test script produced no JUnit report:`,
        )
        for (const pkg of coverage.missing) console.error(`  - ${pkg}`)
        console.error(
            "\nEither make the suite emit one, or opt the package out with the exact\n" +
                `placeholder "test": "echo 'no tests'".`,
        )
        process.exit(1)
    }

    console.log(
        `All ${coverage.expected.length} test-bearing package(s) produced a JUnit report` +
            `${coverage.baseResolved ? ` (base ${coverage.base} included)` : ""}.`,
    )
}
