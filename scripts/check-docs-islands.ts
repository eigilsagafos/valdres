/**
 * Gate: every docs island bundle must survive module evaluation in a browser.
 *
 * The interactive demos on valdres.dev are islands — `demos.js` mounts the API
 * and plugin demos, `landing.js` the home page's per-framework counters. They
 * bundle valdres from workspace SOURCE (see docs/src/islands-build.ts), so a
 * change to core that is fine for the published dist can still be fatal here.
 *
 * That already happened: one engine self-check read `process.env` before
 * short-circuiting on `!IS_PROD`, `process` does not exist in a browser, and the
 * read sat in a module-static graph — so `demos.js` and `landing.js` both threw
 * `ReferenceError: process is not defined` on load. Every demo on the site was
 * dead for three weeks and NOTHING caught it:
 *
 *   - the pages still rendered (they are static HTML; only the islands died),
 *   - placeholders just sat at "Loading demo…", and the browser logged nothing,
 *   - `docs:build` succeeded — bundling never evaluates the bundle,
 *   - and docs-ci does not even run on `packages/**` changes.
 *
 * So this runs in the main CI job on every PR, and bundles the islands itself
 * rather than reusing `docs/dist` — building 210 pages is not needed to find out
 * whether a bundle can be loaded.
 *
 * Faithfulness is the whole point of the two globals below: happy-DOM supplies
 * the `document`/`window` the islands touch at module scope, and `process` is
 * deleted because the browser has none. Without the delete this gate would pass
 * while the site stayed broken.
 */

import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import {
    bundleAllIslands,
    islandDefine,
    islandEntryNames,
    readValdresVersion,
} from "../docs/src/islands-build"

const rootDir = join(import.meta.dir, "..")

/** Printed by the harness only after the bundle has actually been imported. */
const EVALUATED = "__island_evaluated__"

const outdir = await mkdtemp(join(tmpdir(), "valdres-islands-"))

try {
    const valdresVersion = await readValdresVersion(rootDir)
    const results = await bundleAllIslands({
        outdir,
        minify: true,
        define: islandDefine(valdresVersion, "production"),
    })

    let failed = false
    for (const result of results) {
        if (!result.success) {
            failed = true
            console.error("✗ island bundle failed to build:")
            for (const log of result.logs) console.error(`  ${log}`)
        }
    }
    if (failed) process.exit(1)

    for (const name of islandEntryNames) {
        const bundle = Bun.file(join(outdir, name))
        if (!(await bundle.exists())) {
            console.error(
                `✗ ${name}: not emitted — islandEntryNames is out of sync with the bundlers`,
            )
            process.exit(1)
        }

        // A separate process per bundle, mirroring the site: no page loads two
        // valdres-bearing islands (docs pages get demos.js, the home page gets
        // landing.js). It has to stay that way here. A source-bundled valdres
        // resolves its own version to `undefined` — the version define sits
        // behind a `typeof process` guard that a browser bundle folds away — so
        // a second copy in one realm trips the duplicate-runtime guard and
        // reports a version conflict that the real site never has.
        const evaluate = `
            import { GlobalRegistrator } from "@happy-dom/global-registrator"
            GlobalRegistrator.register()
            // The browser has no \`process\`. Restore it before exiting so the
            // harness itself can still report.
            const saved = globalThis.process
            delete globalThis.process
            try {
                await import(${JSON.stringify(pathToFileURL(join(outdir, name)).href)})
            } finally {
                globalThis.process = saved
            }
            console.log("${EVALUATED}")
        `
        const result = Bun.spawnSync(["bun", "-e", evaluate], {
            cwd: rootDir,
            stdout: "pipe",
            stderr: "pipe",
        })

        // Demand the sentinel, not just exit 0. A harness that never ran —
        // `bun run -e` instead of `bun -e`, say, which prints usage and exits 0
        // — would otherwise report every bundle healthy without loading one.
        const evaluated = result.stdout.toString().includes(EVALUATED)
        if (result.exitCode === 0 && !evaluated) {
            console.error(
                `✗ ${name}: harness exited 0 without evaluating the bundle — check the spawn`,
            )
            console.error(result.stdout.toString().trimEnd())
            console.error(result.stderr.toString().trimEnd())
            process.exit(1)
        }

        if (result.exitCode !== 0) {
            console.error(`✗ ${name}: threw while evaluating in a browser realm`)
            console.error(result.stderr.toString().trimEnd())
            console.error(
                "\nThis bundle is loaded by the docs site — every demo it mounts is dead.",
            )
            process.exit(1)
        }
        const size = (bundle.size / 1024).toFixed(0)
        console.log(`✓ ${name} (${size} KB) evaluates cleanly`)
    }

    console.log(`\nAll ${islandEntryNames.length} docs island bundles load.`)
} finally {
    await rm(outdir, { recursive: true, force: true })
}
