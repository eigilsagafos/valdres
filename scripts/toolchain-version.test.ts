import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync } from "fs"
import { join } from "path"

// `.bun-version` is the single source of truth for which Bun this repo is built
// and measured with. It is not decorative: bundler output is toolchain-specific,
// so a Bun mismatch silently invalidates the published-package SIZE GATE.
//
// This bit us once. `scripts/size-baseline.json` had been regenerated on a
// developer's local Bun 1.3.13 while CI enforced it on the pinned 1.4.0, which
// emits ~2.2KB more for identical source — more than the gate's whole 2%
// allowance. `main` passed with 16 bytes of headroom for several releases, so
// any PR adding more than that failed regardless of merit, while
// `bun run check-size` locally reported all gates passing on the very commit CI
// rejected. See .context/nagoya/ARCHITECTURE-REVIEW.md (finding 5).
//
// So the version lives in one file and everything that depends on it is
// asserted against that file here. Bumping Bun is then a deliberate act with a
// visible checklist: update `.bun-version`, update the workflow pins, and
// regenerate the size baseline on the new version.

const rootDir = join(import.meta.dir, "..")
const read = (path: string) => readFileSync(join(rootDir, path), "utf8")

const pinnedVersion = read(".bun-version").trim()

const compareSemver = (a: string, b: string) => {
    const parse = (v: string) =>
        v
            .replace(/^v/, "")
            .split(".")
            .map(part => Number.parseInt(part, 10))
    const [aParts, bParts] = [parse(a), parse(b)]
    for (let i = 0; i < 3; i++) {
        const diff = (aParts[i] ?? 0) - (bParts[i] ?? 0)
        if (diff !== 0) return diff
    }
    return 0
}

describe("pinned Bun toolchain", () => {
    test(".bun-version is a bare semver with no v prefix or range", () => {
        // setup-bun and the version managers that read this file want an exact
        // version. A range here would defeat the point of pinning.
        expect(pinnedVersion).toMatch(/^\d+\.\d+\.\d+$/)
    })

    // Enumerate SETUP STEPS, not pins. Scanning for `bun-version:` keys can
    // only check the pins that still exist: drop the key from one workflow and
    // the remaining pins keep the guard green while that job silently installs
    // whatever Bun is latest — the original failure mode, reintroduced.
    // `oven-sh/setup-bun` does not auto-detect `.bun-version` (its
    // `bun-version-file` input defaults to null), so a step with neither input
    // resolves to latest and must fail here. (Caught by Copilot on PR #329.)
    const setupBunSteps = () => {
        const workflowDir = join(rootDir, ".github/workflows")
        const steps: Array<{
            file: string
            line: number
            key?: string
            value?: string
        }> = []
        for (const file of readdirSync(workflowDir)) {
            if (!file.endsWith(".yml") && !file.endsWith(".yaml")) continue
            const lines = read(`.github/workflows/${file}`).split("\n")
            lines.forEach((line, index) => {
                if (!/uses:\s*oven-sh\/setup-bun/.test(line)) return
                // Sibling keys of `uses:` align with it; anything less indented
                // starts the next step or block, which ends this one.
                const stepIndent = line.indexOf("uses:")
                let key: string | undefined
                let value: string | undefined
                for (let next = index + 1; next < lines.length; next++) {
                    const candidate = lines[next]!
                    if (candidate.trim() === "") continue
                    const indent =
                        candidate.length - candidate.trimStart().length
                    if (indent < stepIndent) break
                    const match = candidate.match(
                        /^\s*(bun-version|bun-version-file):\s*(\S+)\s*$/,
                    )
                    if (match) {
                        key = match[1]
                        value = match[2]
                        break
                    }
                }
                steps.push({ file, line: index + 1, key, value })
            })
        }
        return steps
    }

    test("every setup-bun step declares a Bun version", () => {
        const steps = setupBunSteps()
        // Guard the guard: if the scan stops finding steps at all (e.g. the
        // action is renamed), fail rather than silently assert nothing.
        expect(steps.length).toBeGreaterThan(0)
        const unpinned = steps.filter(step => step.key === undefined)
        expect(unpinned.map(step => `${step.file}:${step.line}`)).toEqual([])
    })

    test("every setup-bun step resolves to the pinned Bun", () => {
        const mismatched = setupBunSteps().filter(step => {
            if (step.key === "bun-version") return step.value !== pinnedVersion
            // Reading the version from a file is fine as long as it is THIS
            // file; any other source can disagree with `.bun-version`.
            if (step.key === "bun-version-file")
                return !/\.bun-version$/.test(step.value ?? "")
            return false // absence is the other test's business
        })
        expect(
            mismatched.map(
                step =>
                    `${step.file}:${step.line} → ${step.key}: ${step.value}`,
            ),
        ).toEqual([])
    })

    test("the size baseline was recorded on the pinned Bun", () => {
        // The assertion that would have caught the original incident. Bumping
        // `.bun-version` without regenerating the baseline fails here, with the
        // fix being `VALDRES_UPDATE_SIZE_BASELINE=1 bun run check-size` on the
        // new version.
        const baseline = JSON.parse(read("scripts/size-baseline.json"))
        expect(baseline.bun).toBe(pinnedVersion)
    })

    test("the pinned Bun satisfies the engines floor in package.json", () => {
        const { engines } = JSON.parse(read("package.json"))
        const floor = engines?.bun?.match(/\d+\.\d+\.\d+/)?.[0]
        expect(floor).toBeDefined()
        expect(compareSemver(pinnedVersion, floor!)).toBeGreaterThanOrEqual(0)
    })
})
