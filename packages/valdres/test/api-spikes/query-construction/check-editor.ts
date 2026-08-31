import ts from "typescript"
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

type MarkerKind = "completion" | "quickinfo"

interface Marker {
    readonly kind: MarkerKind
    readonly name: string
    readonly position: number
}

interface CompletionSnapshot {
    readonly kind: "completion"
    readonly entries: readonly Readonly<{
        name: string
        kind: string
    }>[]
}

interface QuickInfoSnapshot {
    readonly kind: "quickinfo"
    readonly display: string
}

type MarkerSnapshot = CompletionSnapshot | QuickInfoSnapshot

interface EditorSnapshot {
    readonly typescript: string
    readonly markers: Readonly<Record<string, MarkerSnapshot>>
}

const directory = dirname(fileURLToPath(import.meta.url))
const configPath = join(directory, "tsconfig.json")
const fixturePath = join(directory, "editor-fixtures.ts")
const snapshotPath = join(directory, "editor.snapshot.json")

const configFile = ts.readConfigFile(configPath, ts.sys.readFile)
if (configFile.error) {
    throw new Error(formatDiagnostics([configFile.error]))
}

const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    dirname(configPath),
    undefined,
    configPath,
)
if (parsed.errors.length > 0) {
    throw new Error(formatDiagnostics(parsed.errors))
}

const host: ts.LanguageServiceHost = {
    getCompilationSettings: () => parsed.options,
    getCurrentDirectory: () => dirname(configPath),
    getDefaultLibFileName: options => ts.getDefaultLibFilePath(options),
    getScriptFileNames: () => parsed.fileNames,
    getScriptSnapshot: fileName => {
        const text = ts.sys.readFile(fileName)
        return text === undefined
            ? undefined
            : ts.ScriptSnapshot.fromString(text)
    },
    getScriptVersion: () => "0",
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
}

const service = ts.createLanguageService(host, ts.createDocumentRegistry())
const fixtureText = readFileSync(fixturePath, "utf8")
const markers = readMarkers(fixtureText)
const results: Record<string, MarkerSnapshot> = {}

for (const marker of markers) {
    if (results[marker.name] !== undefined) {
        throw new Error(`Duplicate editor marker: ${marker.name}`)
    }

    if (marker.kind === "completion") {
        const completions = service.getCompletionsAtPosition(
            fixturePath,
            marker.position,
            {
                includeCompletionsForImportStatements: false,
                includeCompletionsForModuleExports: false,
            },
        )
        if (completions === undefined) {
            throw new Error(`No completions at marker ${marker.name}`)
        }
        results[marker.name] = {
            kind: "completion",
            entries: completions.entries
                .map(entry => ({ name: entry.name, kind: entry.kind }))
                .sort((left, right) => left.name.localeCompare(right.name)),
        }
        continue
    }

    const quickInfo = service.getQuickInfoAtPosition(
        fixturePath,
        marker.position,
    )
    if (quickInfo === undefined) {
        throw new Error(`No quick info at marker ${marker.name}`)
    }
    results[marker.name] = {
        kind: "quickinfo",
        display: normalizeWhitespace(
            ts.displayPartsToString(quickInfo.displayParts),
        ),
    }
}

const actual: EditorSnapshot = {
    typescript: ts.version,
    markers: Object.fromEntries(
        Object.entries(results).sort(([left], [right]) =>
            left.localeCompare(right),
        ),
    ),
}
const serialized = `${JSON.stringify(actual, null, 4)}\n`

if (process.argv.includes("--update")) {
    writeFileSync(snapshotPath, serialized)
    console.log(`Updated ${snapshotPath}`)
} else {
    const expected = readFileSync(snapshotPath, "utf8")
    if (serialized !== expected) {
        throw new Error(
            `Editor snapshot changed. Review it, then run:\n` +
                `  bun ${resolve(import.meta.filename)} --update`,
        )
    }
    console.log(`Editor snapshot matches TypeScript ${ts.version}`)
}

function readMarkers(text: string): Marker[] {
    const markers: Marker[] = []
    const pattern = /\/\*\^(completion|quickinfo):([a-z0-9-]+)\*\//g
    for (const match of text.matchAll(pattern)) {
        const kind = match[1] as MarkerKind
        const name = match[2]
        const markerEnd = (match.index ?? 0) + match[0].length
        const nextToken = /[A-Za-z_$][\w$]*/y
        nextToken.lastIndex = markerEnd

        while (/\s/.test(text[nextToken.lastIndex] ?? "")) {
            nextToken.lastIndex += 1
        }

        const token = nextToken.exec(text)
        if (token === null) {
            throw new Error(`Marker ${name} is not followed by an identifier`)
        }
        markers.push({ kind, name, position: token.index })
    }
    return markers
}

function normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, " ").trim()
}

function formatDiagnostics(diagnostics: readonly ts.Diagnostic[]): string {
    return ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: value => value,
        getCurrentDirectory: () => process.cwd(),
        getNewLine: () => "\n",
    })
}
