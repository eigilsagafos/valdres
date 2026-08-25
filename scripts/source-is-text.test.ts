import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

// A stray NUL byte makes a source file "binary" to the whole text toolchain:
// `grep` and `git grep` silently skip it (no match, no warning), `git diff`
// prints "Binary files differ", and review tools show nothing. It runs fine, so
// nothing else catches it.
//
// This is not hypothetical — scripts/verify.ts shipped one in a template
// literal used as a map-key separator. It was only noticed because a `grep` for
// a symbol that plainly existed came back empty. Cheap to assert, and the
// failure mode it prevents is "your search tool lies to you".
//
// Scoped to the text sources that tooling actually greps; binary fixtures and
// build output are none of this test's business.

const rootDir = join(import.meta.dir, "..")

const PATTERNS = [
    "scripts/**/*.ts",
    ".github/workflows/*.yaml",
    ".github/workflows/*.yml",
]

const sources = async () => {
    const found: string[] = []
    for (const pattern of PATTERNS)
        for await (const file of new Bun.Glob(pattern).scan({ cwd: rootDir }))
            if (!file.split("/").includes("node_modules")) found.push(file)
    return found.sort()
}

describe("text sources stay text", () => {
    test("no source file contains a NUL byte", async () => {
        const files = await sources()

        // Guard the guard: a scan that finds nothing would pass vacuously.
        expect(files.length).toBeGreaterThan(10)

        const binary = files.filter(file =>
            readFileSync(join(rootDir, file)).includes(0),
        )
        expect(binary).toEqual([])
    })

    test("every source file decodes as UTF-8", async () => {
        const decoder = new TextDecoder("utf-8", { fatal: true })
        const undecodable: string[] = []
        for (const file of await sources()) {
            try {
                decoder.decode(readFileSync(join(rootDir, file)))
            } catch {
                undecodable.push(file)
            }
        }
        expect(undecodable).toEqual([])
    })
})
