/**
 * Builds every publishable package, on the runner that is about to publish it.
 *
 * The `publish` job used to run `bun run build` / `bun run build:types`, which
 * resolve to the two-package v1-beta cohort. The migrated browser packages are
 * built by the separate `browser-media` job, and artifacts do not cross jobs —
 * so prepacking one of them on the publish runner would rewrite its `exports`
 * to `./dist/…` with no `dist` on disk and ship an empty tarball.
 *
 * Deliberately NOT `bun --filter '*' build`: that pulls in the eleven browser
 * packages and four framework adapters that have not been migrated to the v1
 * core and do not build against it.
 *
 *   bun run build:release
 *   bun run build:types:release
 */
import { spawnSync } from "node:child_process"
import { join } from "node:path"
import {
    PUBLISHABLE_PACKAGE_DIRS,
    expectedPackageName,
} from "./lib/publishable-packages"

const ROOT = join(import.meta.dir, "..")
const script = process.argv[2]
if (script !== "build" && script !== "build:types") {
    console.error(
        `Usage: bun run scripts/build-release.ts <build|build:types>\nReceived: ${script ?? "(nothing)"}`,
    )
    process.exit(2)
}

const failures: string[] = []
for (const dir of PUBLISHABLE_PACKAGE_DIRS) {
    const name = expectedPackageName(dir)
    const started = performance.now()
    const result = spawnSync("bun", ["--filter", name, script], {
        cwd: ROOT,
        stdio: "inherit",
    })
    const elapsed = `${((performance.now() - started) / 1000).toFixed(1)}s`
    if (result.status === 0) {
        console.log(`✓ ${name} ${script}  ${elapsed}`)
        continue
    }
    failures.push(name)
    console.error(`✗ ${name} ${script}  ${elapsed}  (exit ${result.status})`)
}

if (failures.length > 0) {
    console.error(
        `\n${failures.length} of ${PUBLISHABLE_PACKAGE_DIRS.length} release ${script} runs failed:\n` +
            failures.map(name => `  - ${name}`).join("\n"),
    )
    process.exit(1)
}
console.log(
    `\n${script} succeeded for all ${PUBLISHABLE_PACKAGE_DIRS.length} publishable packages.`,
)
