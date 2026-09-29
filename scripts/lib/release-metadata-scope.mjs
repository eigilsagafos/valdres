/**
 * Decide whether a Changesets release pull request changes only generated
 * release metadata, so the trusted `publish` job may pre-authorize its commit
 * as benchmark-safe.
 *
 * The allowed package paths are derived from `scripts/publishable-packages.json`:
 * exactly `<dir>/package.json` and `<dir>/CHANGELOG.md` for every listed
 * directory, never a `packages/**` pattern. The workflow reads both this module
 * and that list from the main commit it runs from, not from the release branch
 * Changesets leaves checked out — the release pull request being classified
 * must not supply its own policy. Plain JavaScript so `actions/github-script`
 * can import it without Bun.
 */

export const MAX_RELEASE_FILES = 500

const PACKAGE_DIR = /^packages\/(?:@[a-z0-9-]+\/)?[a-z0-9][a-z0-9-]*$/

/** Exact package metadata paths a release commit may touch. */
export function releaseMetadataPaths(publishablePackagesJson) {
    let dirs
    try {
        dirs = JSON.parse(publishablePackagesJson)
    } catch {
        throw new Error("Publishable package policy is not valid JSON")
    }
    if (!Array.isArray(dirs) || dirs.length === 0) {
        throw new Error("Publishable package policy must be a non-empty array")
    }
    const paths = new Set()
    for (const dir of dirs) {
        if (typeof dir !== "string" || !PACKAGE_DIR.test(dir)) {
            throw new Error(
                `Publishable package policy has an invalid directory: ${JSON.stringify(dir)}`,
            )
        }
        if (paths.has(`${dir}/package.json`)) {
            throw new Error(
                `Publishable package policy lists ${dir} more than once`,
            )
        }
        paths.add(`${dir}/package.json`)
        paths.add(`${dir}/CHANGELOG.md`)
    }
    return paths
}

// Changesets v3 keeps prerelease changesets it has already versioned in
// `.changeset/pre/` instead of listing their ids in `pre.json`, so a release
// commit moves files into that folder as well.
function isGeneratedReleasePath(path, packagePaths) {
    return (
        path === ".changeset/pre.json" ||
        /^\.changeset\/(?:pre\/)?[a-z0-9-]+\.md$/.test(path) ||
        path === "bun.lock" ||
        packagePaths.has(path)
    )
}

/**
 * Throw unless `files` (GitHub's `pulls.listFiles` entries) is a plausible
 * release commit: a bounded, non-empty list whose every path — including each
 * rename source — is generated release metadata, with at least one manifest.
 */
export function assertGeneratedReleaseFiles(files, publishablePackagesJson) {
    const packagePaths = releaseMetadataPaths(publishablePackagesJson)
    if (
        !Array.isArray(files) ||
        files.length === 0 ||
        files.length > MAX_RELEASE_FILES
    ) {
        throw new Error(
            `Unexpected generated release file count: ${files?.length}`,
        )
    }
    const paths = files.flatMap(file => {
        const entry = [file?.filename]
        if (file?.previous_filename != null) entry.push(file.previous_filename)
        return entry
    })
    const unexpected = paths.filter(
        path =>
            typeof path !== "string" ||
            !isGeneratedReleasePath(path, packagePaths),
    )
    if (unexpected.length > 0) {
        throw new Error(
            `Refusing benchmark check for non-release files: ${unexpected.join(", ")}`,
        )
    }
    if (
        !files.some(
            file =>
                file.filename.endsWith("/package.json") &&
                packagePaths.has(file.filename),
        )
    ) {
        throw new Error(
            "Generated release pull request has no package manifest",
        )
    }
}
