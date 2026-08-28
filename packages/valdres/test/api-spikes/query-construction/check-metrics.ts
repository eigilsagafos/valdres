import ts from "typescript"
import { format, resolveConfig } from "prettier"
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

type Grammar = "builder" | "object"
type Ownership = "attached" | "standalone"

interface CandidateIdentity {
    readonly caseId: string
    readonly grammar: Grammar
    readonly ownership: Ownership
}

interface CandidateMetric extends CandidateIdentity {
    readonly name: string
    readonly tokens: number
    readonly canonicalCharacters: number
    readonly lines: number
    readonly calls: number
    readonly callbacks: number
    readonly objectLiterals: number
    readonly propertyAccesses: number
    readonly concepts: readonly string[]
    readonly conceptCount: number
}

interface SupportMetric {
    readonly grammar: Grammar
    readonly declarations: readonly string[]
    readonly tokens: number
    readonly canonicalCharacters: number
    readonly lines: number
    readonly concepts: readonly string[]
}

interface ReusableFragmentTotal extends CandidateIdentity {
    readonly useSiteTokens: number
    readonly supportTokens: number
    readonly totalTokens: number
    readonly totalCanonicalCharacters: number
    readonly totalLines: number
    readonly concepts: readonly string[]
}

interface MetricsSnapshot {
    readonly typescript: string
    readonly operatorImports: readonly string[]
    readonly candidates: readonly CandidateMetric[]
    readonly reusableSupport: readonly SupportMetric[]
    readonly reusableFragmentTotals: readonly ReusableFragmentTotal[]
    readonly meanTokens: Readonly<Record<string, number>>
}

const cases = new Map<string, string>([
    ["Simple", "simple"],
    ["PopularDrama", "popular-drama"],
    ["NestedBoolean", "nested-boolean"],
    ["RepeatedConstraint", "repeated-constraint"],
    ["ReusableFragments", "reusable-fragments"],
    ["ByGenre", "family"],
])
const variants = [
    "standalone:builder",
    "standalone:object",
    "attached:builder",
    "attached:object",
] as const
const caseConcepts = new Map<string, readonly string[]>([
    ["simple", ["filter"]],
    [
        "popular-drama",
        ["filter", "boolean-conjunction", "order", "pagination", "facets"],
    ],
    ["nested-boolean", ["filter", "nested-boolean"]],
    ["repeated-constraint", ["filter", "same-index-conjunction"]],
    ["reusable-fragments", ["filter", "reusable-fragments"]],
    ["family", ["filter", "order", "pagination", "family-parameters"]],
])
const supportDeclarations: Readonly<Record<Grammar, readonly string[]>> = {
    builder: ["MovieQueryBuilder", "isClassic", "isRecent"],
    object: ["classicObjectFragment", "recentObjectFragment"],
}
const supportConcepts: Readonly<Record<Grammar, readonly string[]>> = {
    builder: ["builder-type-alias", "predicate-fragment-functions"],
    object: ["typed-object-fragments"],
}
const operatorNames = new Set([
    "all",
    "and",
    "any",
    "anyOf",
    "asc",
    "between",
    "desc",
    "eq",
    "facet",
    "gt",
    "gte",
    "has",
    "hasAll",
    "hasAny",
    "lt",
    "lte",
    "not",
    "or",
])

const directory = dirname(fileURLToPath(import.meta.url))
const fixturePath = join(directory, "fixtures.ts")
const snapshotPath = join(directory, "metrics.snapshot.json")
const sourceText = readFileSync(fixturePath, "utf8")
const source = ts.createSourceFile(
    fixturePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
)

const operatorImports = source.statements
    .filter(ts.isImportDeclaration)
    .flatMap(statement => {
        const bindings = statement.importClause?.namedBindings
        return bindings !== undefined && ts.isNamedImports(bindings)
            ? bindings.elements.map(element => element.name.text)
            : []
    })
    .filter(name => operatorNames.has(name))
    .sort()

const candidates: CandidateMetric[] = []
for (const statement of source.statements) {
    if (
        !ts.isVariableStatement(statement) ||
        !statement.modifiers?.some(
            modifier => modifier.kind === ts.SyntaxKind.ExportKeyword,
        )
    ) {
        continue
    }

    for (const declaration of statement.declarationList.declarations) {
        if (
            !ts.isIdentifier(declaration.name) ||
            declaration.initializer === undefined
        ) {
            continue
        }
        const identity = identifyCandidate(declaration.name.text)
        if (identity === undefined) {
            continue
        }
        const text = normalizeCandidateText(
            declaration.initializer.getText(source),
        )
        const counts = countSyntax(declaration.initializer)
        const concepts = conceptsFor(identity)
        candidates.push({
            ...identity,
            name: declaration.name.text,
            tokens: countTokens(text),
            canonicalCharacters: text.length,
            lines: text.split(/\r?\n/).length,
            ...counts,
            concepts,
            conceptCount: concepts.length,
        })
    }
}

candidates.sort((left, right) =>
    `${left.caseId}:${left.ownership}:${left.grammar}`.localeCompare(
        `${right.caseId}:${right.ownership}:${right.grammar}`,
    ),
)
assertParity(candidates)

const reusableSupport = (["builder", "object"] as const).map(grammar =>
    measureSupport(grammar),
)
const reusableFragmentTotals = candidates
    .filter(candidate => candidate.caseId === "reusable-fragments")
    .map(candidate => {
        const support = reusableSupport.find(
            item => item.grammar === candidate.grammar,
        )
        if (support === undefined) {
            throw new Error(`Missing ${candidate.grammar} reusable support`)
        }
        return {
            caseId: candidate.caseId,
            grammar: candidate.grammar,
            ownership: candidate.ownership,
            useSiteTokens: candidate.tokens,
            supportTokens: support.tokens,
            totalTokens: candidate.tokens + support.tokens,
            totalCanonicalCharacters:
                candidate.canonicalCharacters + support.canonicalCharacters,
            totalLines: candidate.lines + support.lines,
            concepts: [
                ...new Set([...candidate.concepts, ...support.concepts]),
            ],
        }
    })

const meanTokens = Object.fromEntries(
    variants.map(variant => {
        const [ownership, grammar] = variant.split(":") as [Ownership, Grammar]
        const matching = candidates.filter(
            candidate =>
                candidate.ownership === ownership &&
                candidate.grammar === grammar,
        )
        return [
            variant,
            Number(
                (
                    matching.reduce((total, item) => total + item.tokens, 0) /
                    matching.length
                ).toFixed(2),
            ),
        ]
    }),
)

const snapshot: MetricsSnapshot = {
    typescript: ts.version,
    operatorImports,
    candidates,
    reusableSupport,
    reusableFragmentTotals,
    meanTokens,
}
const prettierOptions = (await resolveConfig(snapshotPath)) ?? {}
const serialized = await format(JSON.stringify(snapshot), {
    ...prettierOptions,
    filepath: snapshotPath,
})

if (process.argv.includes("--update")) {
    writeFileSync(snapshotPath, serialized)
    console.log(`Updated ${snapshotPath}`)
} else {
    const expected = readFileSync(snapshotPath, "utf8")
    if (serialized !== expected) {
        throw new Error(
            `Query metrics changed. Review them, then run:\n` +
                `  bun ${resolve(import.meta.filename)} --update`,
        )
    }
    console.log(
        `Query metrics match: ${candidates.length} candidates, zero operator imports`,
    )
}

function identifyCandidate(name: string): CandidateIdentity | undefined {
    let ownership: Ownership
    let grammar: Grammar
    let suffix: string

    if (name.startsWith("attachedBuilder")) {
        ownership = "attached"
        grammar = "builder"
        suffix = name.slice("attachedBuilder".length)
    } else if (name.startsWith("attachedObject")) {
        ownership = "attached"
        grammar = "object"
        suffix = name.slice("attachedObject".length)
    } else if (name.startsWith("builder")) {
        ownership = "standalone"
        grammar = "builder"
        suffix = name.slice("builder".length)
    } else if (name.startsWith("object")) {
        ownership = "standalone"
        grammar = "object"
        suffix = name.slice("object".length)
    } else {
        return undefined
    }

    const caseId = cases.get(suffix)
    return caseId === undefined ? undefined : { caseId, grammar, ownership }
}

function countTokens(text: string): number {
    const scanner = ts.createScanner(
        ts.ScriptTarget.Latest,
        true,
        ts.LanguageVariant.Standard,
        text,
    )
    let count = 0
    while (scanner.scan() !== ts.SyntaxKind.EndOfFileToken) {
        count += 1
    }
    return count
}

function conceptsFor(identity: CandidateIdentity): readonly string[] {
    const features = caseConcepts.get(identity.caseId)
    if (features === undefined) {
        throw new Error(`Missing concept rubric for ${identity.caseId}`)
    }
    return [
        identity.ownership === "attached"
            ? "collection-attached-owner"
            : "standalone-query-owner",
        identity.grammar === "builder"
            ? "query-local-builder-callback"
            : "recursive-object-grammar",
        ...features,
    ]
}

function measureSupport(grammar: Grammar): SupportMetric {
    const names = supportDeclarations[grammar]
    const statements = source.statements.filter(statement =>
        names.some(name => statementDeclares(statement, name)),
    )
    const missing = names.filter(
        name =>
            !statements.some(statement => statementDeclares(statement, name)),
    )
    if (missing.length > 0) {
        throw new Error(
            `${grammar} reusable support is missing: ${missing.join(", ")}`,
        )
    }
    const texts = statements.map(statement =>
        normalizeCandidateText(statement.getText(source)),
    )
    return {
        grammar,
        declarations: names,
        tokens: texts.reduce((total, text) => total + countTokens(text), 0),
        canonicalCharacters: texts.reduce(
            (total, text) => total + text.length,
            0,
        ),
        lines: texts.reduce(
            (total, text) => total + text.split(/\r?\n/).length,
            0,
        ),
        concepts: supportConcepts[grammar],
    }
}

function statementDeclares(statement: ts.Statement, name: string): boolean {
    if (ts.isTypeAliasDeclaration(statement))
        return statement.name.text === name
    if (!ts.isVariableStatement(statement)) return false
    return statement.declarationList.declarations.some(
        declaration =>
            ts.isIdentifier(declaration.name) && declaration.name.text === name,
    )
}

function normalizeCandidateText(text: string): string {
    return text
        .replace(/\bqueryWith(?:Builder|Object)\b/g, "query")
        .replace(/\b(?:builder|object)Movies\b/g, "movies")
}

function countSyntax(
    root: ts.Node,
): Pick<
    CandidateMetric,
    "calls" | "callbacks" | "objectLiterals" | "propertyAccesses"
> {
    let calls = 0
    let callbacks = 0
    let objectLiterals = 0
    let propertyAccesses = 0
    const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node)) calls += 1
        if (ts.isArrowFunction(node) || ts.isFunctionExpression(node))
            callbacks += 1
        if (ts.isObjectLiteralExpression(node)) objectLiterals += 1
        if (ts.isPropertyAccessExpression(node)) propertyAccesses += 1
        ts.forEachChild(node, visit)
    }
    visit(root)
    return { calls, callbacks, objectLiterals, propertyAccesses }
}

function assertParity(items: readonly CandidateMetric[]): void {
    for (const caseId of cases.values()) {
        const found = new Set(
            items
                .filter(item => item.caseId === caseId)
                .map(item => `${item.ownership}:${item.grammar}`),
        )
        const missing = variants.filter(variant => !found.has(variant))
        if (missing.length > 0) {
            throw new Error(
                `${caseId} is missing variants: ${missing.join(", ")}`,
            )
        }
    }
}
