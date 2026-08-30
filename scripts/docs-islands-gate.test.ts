import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

/**
 * Legacy docs still have an executable-island gate, but they are deliberately
 * outside the certified core+React beta train. These assertions keep them out
 * of unfiltered package CI and require an explicit maintainer dispatch before
 * the gated Pages deployment can run.
 */

const GATE = "bun run scripts/check-docs-islands.ts"

const workflow = (name: string) =>
    readFileSync(join(import.meta.dir, `../.github/workflows/${name}`), "utf8")

describe("docs island gate wiring", () => {
    test("stays outside the certified core and React CI job", () => {
        const ci = workflow("ci.yaml")
        expect(ci).not.toContain(GATE)
        const testJob = ci.slice(
            ci.indexOf("    test:"),
            ci.indexOf("    valdres-package:"),
        )
        expect(testJob).not.toContain(GATE)
    })

    test("gates an explicit manual deployment", () => {
        const publish = workflow("publish-docs.yaml")
        expect(publish).toContain("workflow_dispatch:")
        expect(publish).not.toContain("    push:")
        expect(publish).toContain(GATE)
        // It must run before upload, or a broken bundle still reaches Pages.
        expect(publish.indexOf(GATE)).toBeLessThan(
            publish.indexOf("upload-pages-artifact"),
        )
    })

    test("keeps the full legacy docs build manual during the v1 beta", () => {
        const docs = workflow("docs-ci.yml")
        expect(docs).toContain("workflow_dispatch:")
        expect(docs).not.toContain("    pull_request:")
        expect(docs).toContain("bun run docs:build")
        expect(docs).toContain("bun run scripts/gen-readmes.ts --check")

        const ci = workflow("ci.yaml")
        expect(ci).toContain("bun run scripts/gen-readmes.ts --check")
        expect(ci).not.toContain("bun run docs:build")
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
