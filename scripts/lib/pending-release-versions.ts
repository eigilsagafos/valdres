import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

/**
 * The versions pending changesets will produce, per Changesets itself, or an
 * empty map when there is no pending changeset — right after a Version
 * Packages merge, when the manifests already carry the release versions.
 *
 * Its release plan needs no git, but `changeset status` also compares against
 * a branch: `--since` the repository's first commit counts every pending
 * changeset and works without a local `main` (needs full history). With no
 * pending changeset, `status` would only fail on its "changed but no
 * changesets" check, so it is not asked.
 */
export const pendingReleaseVersions = (root: string): Map<string, string> => {
    const pending = readdirSync(join(root, ".changeset")).filter(
        file => file.endsWith(".md") && file !== "README.md",
    )
    const versions = new Map<string, string>()
    if (pending.length === 0) return versions
    const run = (command: string[]) => {
        const result = spawnSync(command[0]!, command.slice(1), {
            cwd: root,
            encoding: "utf8",
        })
        if (result.status !== 0)
            throw new Error(
                `${command.join(" ")} failed (exit ${result.status})\n${result.stdout}\n${result.stderr}`,
            )
        return result.stdout
    }
    const firstCommit = run(["git", "rev-list", "--max-parents=0", "HEAD"])
        .trim()
        .split("\n")
        .at(-1)!
    const workspace = mkdtempSync(join(tmpdir(), "valdres-release-plan-"))
    try {
        const output = join(workspace, "plan.json")
        run([
            "bunx",
            "changeset",
            "status",
            `--since=${firstCommit}`,
            `--output=${output}`,
        ])
        for (const release of JSON.parse(readFileSync(output, "utf8"))
            .releases as { name: string; newVersion: string }[])
            versions.set(release.name, release.newVersion)
    } finally {
        rmSync(workspace, { recursive: true, force: true })
    }
    return versions
}
