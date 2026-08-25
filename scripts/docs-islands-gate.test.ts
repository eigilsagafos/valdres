import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

/**
 * The gate that keeps valdres.dev's demos alive is only as good as its wiring.
 * It caught nothing for three weeks because no workflow ran it: `docs-ci.yml`
 * is path-filtered to docs files, and the change that killed every demo was in
 * `packages/valdres/src`. These assertions pin the wiring that closes that hole.
 */

const GATE = "bun run scripts/check-docs-islands.ts"

const workflow = (name: string) =>
    readFileSync(join(import.meta.dir, `../.github/workflows/${name}`), "utf8")

describe("docs island gate wiring", () => {
    test("runs in the unfiltered CI job, not only the path-filtered docs job", () => {
        const ci = workflow("ci.yaml")
        expect(ci).toContain(GATE)

        // The `test` job has no `paths:` filter, so it runs on every PR —
        // including core-only ones, which is exactly the case that broke.
        const testJob = ci.slice(
            ci.indexOf("    test:"),
            ci.indexOf("    valdres-package:"),
        )
        expect(testJob).toContain(GATE)
    })

    test("gates the deploy, which races CI on push to main", () => {
        const publish = workflow("publish-docs.yaml")
        expect(publish).toContain(GATE)
        // Before the upload, or a broken bundle still reaches the live site.
        expect(publish.indexOf(GATE)).toBeLessThan(
            publish.indexOf("upload-pages-artifact"),
        )
    })

    test("checks every island bundle the site loads with a script tag", () => {
        // Kept honest against the renderers: their script tags are the
        // definitive list of what a visitor's browser evaluates. RootLayout
        // serves the docs pages (client + demos), LandingPage the home page
        // (client + landing). `playground-bundle.js` is appended by client.ts on
        // demand, so it has no tag here — the gate covers a superset.
        const shipped = ["RootLayout", "LandingPage"].flatMap(layout =>
            [
                ...readFileSync(
                    join(import.meta.dir, `../docs/src/layout/${layout}.tsx`),
                    "utf8",
                ).matchAll(/src="\/([a-z-]+\.js)"/g),
            ].map(match => match[1]),
        )
        expect(shipped).toContain("demos.js")
        expect(shipped).toContain("landing.js")

        const gate = readFileSync(
            join(import.meta.dir, "../docs/src/islands-build.ts"),
            "utf8",
        )
        const checked = gate.slice(gate.indexOf("islandEntryNames"))
        for (const bundle of shipped) {
            expect(checked).toContain(`"${bundle}"`)
        }
    })
})
