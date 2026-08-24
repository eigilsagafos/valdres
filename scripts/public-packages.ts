/**
 * The set of workspace packages that get published to npm.
 *
 * `scripts/ci-publish.sh` and `scripts/verify-publish.ts` both need this list
 * and used to hardcode it separately. Adding a package therefore meant
 * remembering two edits, and forgetting the ci-publish.sh one was silent:
 * the package skipped prepack and shipped with `exports` still pointing at
 * `./src/index.ts` while `files: ["dist"]` packed only the build output. The
 * pull-request dry run could not catch it either, because it walks the same
 * incomplete list. Deriving the set removes that failure mode rather than
 * guarding it.
 *
 * The rule is the one `changeset publish` itself applies: a package is
 * publishable when it sits under a root `workspaces` glob and is not marked
 * `private`. Matching it means the prepack list cannot drift from the set npm
 * actually receives.
 *
 * Run this file directly to print one repo-relative directory per line, which
 * is how ci-publish.sh consumes it. Pass `--json` for the full records.
 */

import { Glob } from "bun"

export const REPO_ROOT = `${import.meta.dir}/..`

export interface PublicPackage {
    /** Repo-relative directory, e.g. `packages/@valdres/browser-window`. */
    dir: string
    /** npm package name, e.g. `@valdres/browser-window`. */
    name: string
    /** Version currently declared in the package manifest. */
    version: string
}

export async function readPublicPackages(
    rootDir: string = REPO_ROOT,
): Promise<PublicPackage[]> {
    const rootManifest = await Bun.file(`${rootDir}/package.json`).json()
    const workspaces: unknown = rootManifest.workspaces
    if (!Array.isArray(workspaces) || workspaces.length === 0) {
        throw new Error("Root package.json declares no workspaces")
    }

    const byDir = new Map<string, PublicPackage>()
    for (const pattern of workspaces) {
        const glob = new Glob(`${pattern}/package.json`)
        for await (const match of glob.scan({
            cwd: rootDir,
            onlyFiles: true,
        })) {
            const manifestPath = match.replaceAll("\\", "/")
            const dir = manifestPath.slice(0, -"/package.json".length)
            if (byDir.has(dir)) continue

            const manifest = await Bun.file(`${rootDir}/${manifestPath}`).json()
            if (manifest.private) continue
            if (
                typeof manifest.name !== "string" ||
                typeof manifest.version !== "string"
            ) {
                throw new Error(
                    `${manifestPath} must declare a name and a version, or be marked private`,
                )
            }

            byDir.set(dir, {
                dir,
                name: manifest.name,
                version: manifest.version,
            })
        }
    }

    if (byDir.size === 0) {
        throw new Error("No publishable packages found in the workspace")
    }

    return [...byDir.values()].sort((a, b) => a.dir.localeCompare(b.dir))
}

if (import.meta.main) {
    const packages = await readPublicPackages()
    if (process.argv.includes("--json")) {
        console.log(JSON.stringify(packages, null, 4))
    } else {
        console.log(packages.map(pkg => pkg.dir).join("\n"))
    }
}
