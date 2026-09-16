import { describe, expect, test } from "bun:test"
import ts from "typescript"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

// `family()` infers one Factory type parameter and rejects invalid factories
// through conditional parameter types. The rejection has to read as guidance
// in the compiler output, not as "not assignable to parameter of type 'never'",
// so this suite compiles a fixture with the real TypeScript checker and reads
// the diagnostics back. Every case is one source line, so the fixture line
// number identifies the case.

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
const fixturePath = join(directory, "family-diagnostics.fixture.virtual.ts")
const fixturePrelude =
    'import { atom, family, selector, type Atom, type Selector } from "../../src/index"\n'
const fixtureSource =
    fixturePrelude + cases.map(item => item.source).join("\n") + "\n"

const readCompilerOptions = (): ts.CompilerOptions => {
    const configPath = join(directory, "tsconfig.json")
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile)
    if (configFile.error) {
        throw new Error(
            ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"),
        )
    }
    const parsed = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        directory,
        undefined,
        configPath,
    )
    return { ...parsed.options, noEmit: true }
}

const compileFixture = (): readonly ts.Diagnostic[] => {
    const options = readCompilerOptions()
    const host = ts.createCompilerHost(options, true)
    const fileExists = host.fileExists
    const readFile = host.readFile
    const getSourceFile = host.getSourceFile
    host.fileExists = fileName =>
        fileName === fixturePath || fileExists(fileName)
    host.readFile = fileName =>
        fileName === fixturePath ? fixtureSource : readFile(fileName)
    host.getSourceFile = (fileName, languageVersion, onError, shouldCreate) =>
        fileName === fixturePath
            ? ts.createSourceFile(
                  fileName,
                  fixtureSource,
                  languageVersion,
                  true,
              )
            : getSourceFile(fileName, languageVersion, onError, shouldCreate)
    const program = ts.createProgram([fixturePath], options, host)
    return ts.getPreEmitDiagnostics(program)
}

const describeDiagnostic = (diagnostic: ts.Diagnostic): string =>
    ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")

describe("family diagnostics", () => {
    const diagnostics = compileFixture()
    const byCase = new Map<number, string[]>()
    const elsewhere: string[] = []
    for (const diagnostic of diagnostics) {
        if (
            diagnostic.file?.fileName !== fixturePath ||
            diagnostic.start === undefined
        ) {
            elsewhere.push(describeDiagnostic(diagnostic))
            continue
        }
        const { line } = diagnostic.file.getLineAndCharacterOfPosition(
            diagnostic.start,
        )
        const index = line - 1
        byCase.set(index, [
            ...(byCase.get(index) ?? []),
            describeDiagnostic(diagnostic),
        ])
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
