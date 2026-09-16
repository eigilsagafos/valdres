// Child-process half of family-diagnostics.test.ts. Reads a fixture source
// from stdin, compiles it with this lane's tsconfig against ../../src/index,
// and prints the fixture's diagnostics as JSON. It runs out of process because
// a TypeScript Program is large enough to delay the GC-driven lifecycle tests
// that share the runtime lane's heap.
import ts from "typescript"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

export interface FixtureDiagnostic {
    readonly line: number
    readonly message: string
}

export interface CompileResult {
    readonly fixture: readonly FixtureDiagnostic[]
    readonly elsewhere: readonly string[]
}

const directory = dirname(fileURLToPath(import.meta.url))
const fixturePath = join(directory, "family-diagnostics.fixture.virtual.ts")

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

const compileFixture = (fixtureSource: string): CompileResult => {
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

    const fixture: FixtureDiagnostic[] = []
    const elsewhere: string[] = []
    for (const diagnostic of ts.getPreEmitDiagnostics(program)) {
        const message = ts.flattenDiagnosticMessageText(
            diagnostic.messageText,
            "\n",
        )
        if (
            diagnostic.file?.fileName !== fixturePath ||
            diagnostic.start === undefined
        ) {
            elsewhere.push(message)
            continue
        }
        const { line } = diagnostic.file.getLineAndCharacterOfPosition(
            diagnostic.start,
        )
        fixture.push({ line, message })
    }
    return { fixture, elsewhere }
}

if (import.meta.main) {
    const source = await new Response(Bun.stdin.stream()).text()
    process.stdout.write(JSON.stringify(compileFixture(source)))
}
