import { afterEach, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { rewriteDeclarationImports } from "./rewrite-declaration-imports"

const temporaryDirs: string[] = []

async function fixture(files: Record<string, string>) {
    const dir = await mkdtemp(join(tmpdir(), "declaration-imports-"))
    temporaryDirs.push(dir)
    await Promise.all(
        Object.entries(files).map(async ([path, content]) => {
            const file = join(dir, path)
            await mkdir(dirname(file), { recursive: true })
            await Bun.write(file, content)
        }),
    )
    return dir
}

afterEach(async () => {
    await Promise.all(
        temporaryDirs
            .splice(0)
            .map(dir => rm(dir, { recursive: true, force: true })),
    )
})

test("rewrites file, directory-index, and import-type specifiers", async () => {
    const dir = await fixture({
        "index.d.ts": [
            'export type { Direct } from "./direct";',
            'export type { Nested } from "./nested";',
            'export type Parent = import(".").Parent;',
            'export type Literal = "./not-a-module";',
        ].join("\n"),
        "direct.d.ts": "export interface Direct {}\n",
        "nested/index.d.ts": "export interface Nested {}\n",
    })

    expect(await rewriteDeclarationImports(dir)).toBe(3)
    expect(await Bun.file(join(dir, "index.d.ts")).text()).toBe(
        [
            'export type { Direct } from "./direct.js";',
            'export type { Nested } from "./nested/index.js";',
            'export type Parent = import("./index.js").Parent;',
            'export type Literal = "./not-a-module";',
        ].join("\n"),
    )
})

test("leaves explicit JavaScript and JSON specifiers unchanged", async () => {
    const source = [
        'export * from "./one.js";',
        'export * from "./two.mjs";',
        'export * from "./three.cjs";',
        'export type Data = import("./data.json");',
    ].join("\n")
    const dir = await fixture({ "entry.d.ts": source })

    expect(await rewriteDeclarationImports(dir)).toBe(0)
    expect(await Bun.file(join(dir, "entry.d.ts")).text()).toBe(source)
})

test("fails without partially rewriting an unresolved tree", async () => {
    const source = 'export * from "./valid";\nexport * from "./missing";\n'
    const dir = await fixture({
        "entry.d.ts": source,
        "valid.d.ts": "export {}\n",
    })

    await expect(rewriteDeclarationImports(dir)).rejects.toThrow(
        'Cannot resolve declaration import "./missing"',
    )
    expect(await Bun.file(join(dir, "entry.d.ts")).text()).toBe(source)
})

test("rejects ambiguous file and directory-index targets", async () => {
    const dir = await fixture({
        "entry.d.ts": 'export * from "./target";\n',
        "target.d.ts": "export {}\n",
        "target/index.d.ts": "export {}\n",
    })

    await expect(rewriteDeclarationImports(dir)).rejects.toThrow(
        'Ambiguous declaration import "./target"',
    )
})
