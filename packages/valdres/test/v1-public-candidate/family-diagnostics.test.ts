import { describe, expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import type { CompileResult } from "./family-diagnostics.compile"

// `family()` infers one Factory type parameter and rejects invalid factories
// through conditional parameter types. The rejection has to read as guidance
// in the compiler output, not as "not assignable to parameter of type 'never'",
// so this suite compiles a fixture with the real TypeScript checker (in a
// child process, see family-diagnostics.compile.ts) and reads the diagnostics
// back. Every case is one source line, so the fixture line identifies the case.

interface DiagnosticCase {
    readonly source: string
    readonly guidance: string | null
}

const cases: readonly DiagnosticCase[] = [
    {
        source: "family((input: { readonly id: string }) => atom(input.id))",
        guidance: "structured family arguments require options.encodeKey",
    },
    {
        source: "family((first: string, second: { readonly id: string }) => atom(first + second.id))",
        guidance: "structured family arguments require options.encodeKey",
    },
    {
        source: "family((input: { readonly id: string }) => atom(input.id), {})",
        guidance: "structured family arguments require options.encodeKey",
    },
    {
        source: "family(() => atom(0))",
        guidance: "family factories require at least one argument",
    },
    {
        source: 'family(() => atom(0), { encodeKey: () => "key" })',
        guidance: "family factories require at least one argument",
    },
    {
        source: "family((...keys: string[]) => atom(keys.join()))",
        guidance: "family factories require at least one argument",
    },
    {
        source: "family(async (key: string) => atom(key))",
        guidance: "family factories must return an Atom or Selector",
    },
    {
        source: "family((key: string) => key)",
        guidance: "family factories must return an Atom or Selector",
    },
    {
        source: "family(key => atom(key))",
        guidance:
            "family requires a factory function with annotated parameters",
    },
    {
        source: "family(null)",
        guidance:
            "family requires a factory function with annotated parameters",
    },
    {
        source: "export const a = family((key: string) => atom(key))",
        guidance: null,
    },
    {
        source: "export const b = family((first: string, second: number) => atom(`${first}${second}`))",
        guidance: null,
    },
    {
        source: "export const c = family((key: string) => selector(get => get(a(key))))",
        guidance: null,
    },
    {
        source: "export const d = family((input: { readonly id: string }) => atom(input.id), { encodeKey: input => input.id })",
        guidance: null,
    },
    {
        source: "export const e = family((first: string, second: { readonly id: string }) => atom(first), { encodeKey: (first, second) => `${first}:${second.id}` })",
        guidance: null,
    },
    {
        source: "export const f = family((key: string) => atom(key), { encodeKey: key => key.toUpperCase() })",
        guidance: null,
    },
    {
        source: 'export const g: [Atom<string>, Atom<string>, Selector<string>, Atom<string>] = [a("k"), b("k", 1), c("k"), d({ id: "k" })]',
        guidance: null,
    },
]

const directory = dirname(fileURLToPath(import.meta.url))
const fixturePrelude =
    'import { atom, family, selector, type Atom, type Selector } from "../../src/index"\n'
const fixtureSource =
    fixturePrelude + cases.map(item => item.source).join("\n") + "\n"

const compileFixture = (): CompileResult => {
    const result = spawnSync(
        process.execPath,
        [join(directory, "family-diagnostics.compile.ts")],
        { cwd: directory, input: fixtureSource, encoding: "utf8" },
    )
    if (result.status !== 0) {
        throw new Error(`fixture compile failed: ${result.stderr}`)
    }
    return JSON.parse(result.stdout) as CompileResult
}

describe("family diagnostics", () => {
    const { fixture, elsewhere } = compileFixture()
    const byCase = new Map<number, string[]>()
    for (const diagnostic of fixture) {
        const index = diagnostic.line - 1
        byCase.set(index, [...(byCase.get(index) ?? []), diagnostic.message])
    }

    test("the fixture only produces diagnostics on the fixture lines", () => {
        expect(elsewhere).toEqual([])
    })

    for (const [index, item] of cases.entries()) {
        const messages = byCase.get(index) ?? []
        if (item.guidance === null) {
            test(`accepts ${item.source}`, () => {
                expect(messages).toEqual([])
            })
            continue
        }
        const guidance = item.guidance
        test(`rejects ${item.source}`, () => {
            expect(messages).toHaveLength(1)
            const [message] = messages
            expect(message).toContain(guidance)
            expect(message).not.toContain("type 'never'")
        })
    }
})
