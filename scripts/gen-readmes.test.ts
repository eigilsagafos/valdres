import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const rootDir = join(import.meta.dir, "..")
const read = (path: string) => readFileSync(join(rootDir, path), "utf8")
const normalizeProse = (value: string) => value.replace(/\s+/g, " ")

describe("generated core README facts", () => {
    test("inspection schema prose follows the runtime export", () => {
        const inspectionSource = read(
            "packages/valdres/src/v1-internal/inspection.ts",
        )
        const match = inspectionSource.match(
            /export interface InspectionExport[\s\S]*?readonly schemaVersion: (\d+)/,
        )

        expect(match).not.toBeNull()
        const schemaSentence = `The core inspection schema is version ${match![1]}.`

        expect(normalizeProse(read("scripts/gen-readmes.ts"))).toContain(
            schemaSentence,
        )
        expect(normalizeProse(read("packages/valdres/README.md"))).toContain(
            schemaSentence,
        )
        expect(normalizeProse(read("README.md"))).toContain(schemaSentence)
    })

    test("the root and package overviews expose keyed collections", () => {
        for (const path of [
            "scripts/gen-readmes.ts",
            "packages/valdres/README.md",
            "README.md",
        ]) {
            const contents = read(path)
            expect(contents).toContain("## Keyed collections")
            expect(contents).toContain("`collection()`")
            expect(contents).toContain("`presence(row)`")
        }
    })
})
