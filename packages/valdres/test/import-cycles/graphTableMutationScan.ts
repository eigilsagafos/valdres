import ts from "typescript"
import { resolve } from "node:path"
import { PACKAGE_ROOT } from "./importGraph"

/**
 * TypeScript-checker-based scan for writes to the dependency-graph tables on
 * `StoreData` (see src/lib/graph/index.ts for the ownership contract). Powers
 * graphBoundary.test.ts.
 *
 * A regex over receivers cannot carry this guarantee: real mutation shapes in
 * the codebase flow through aliased Sets/Maps (`deps.add(...)` where `deps`
 * came from `data.stateDependencies.get(...)`), destructuring, renamed
 * receivers, bracket access (`data["stateDependents"]`, including computed
 * string keys — flagged conservatively; symbol-keyed slots are exempt), and
 * optional chains. This scan instead resolves the RECEIVER'S
 * TYPE with the compiler — any expression whose type is `StoreData` counts,
 * however it is named — and tracks local aliases of graph tables and of their
 * contained Sets syntactically. The transaction overlay
 * (`SelectorEvaluationRuntime`) and the lifecycle ledgers (`StoreResources`)
 * are exempt BY TYPE, not by variable name, so renaming a receiver cannot
 * smuggle a write past the guard, and `StoreData.mounts` is distinguished
 * from the ledger's `mounts` Set. An `any`/`unknown`-typed receiver with an
 * owned property name is flagged conservatively — an untyped escape hatch
 * must not become a mutation side door.
 */

/** Container-valued graph tables: mutated through set/add/delete/clear, on the
 *  table itself or on a Set retrieved from it. */
export const GRAPH_TABLES = new Set([
    "stateDependencies",
    "stateDependents",
    "selectorGraphActive",
    "inheritedDependencyBranches",
    "inheritedDependencyKeys",
    "graphNodes",
    "mounts",
    "livenessSeeds",
    "pendingOrphanCleanup",
])

/** Scalar/replaceable graph fields: mutated by assignment or ++/--. */
export const GRAPH_SCALARS = new Set([
    "dependencyGraphVersion",
    "nextDependencyOrder",
    "orphanCleanupScheduled",
    "livenessPassActive",
    "livenessSeeds",
    "livenessRemovalArmed",
    "livenessLazyArmed",
    "pendingOrphanCleanup",
])

const MUTATING_METHODS = new Set(["set", "add", "delete", "clear"])

const ASSIGNMENT_OPS = new Set<ts.SyntaxKind>([
    ts.SyntaxKind.EqualsToken,
    ts.SyntaxKind.PlusEqualsToken,
    ts.SyntaxKind.MinusEqualsToken,
    ts.SyntaxKind.QuestionQuestionEqualsToken,
    ts.SyntaxKind.BarBarEqualsToken,
    ts.SyntaxKind.AmpersandAmpersandEqualsToken,
])

export type MutationViolation = {
    file: string
    line: number
    property: string
    text: string
}

const stripWrappers = (node: ts.Expression): ts.Expression => {
    while (
        ts.isParenthesizedExpression(node) ||
        ts.isAsExpression(node) ||
        ts.isNonNullExpression(node) ||
        ts.isSatisfiesExpression(node)
    ) {
        node = node.expression
    }
    return node
}

const typeMatches = (
    checker: ts.TypeChecker,
    type: ts.Type,
    name: string,
): boolean => {
    if (type.aliasSymbol?.name === name) return true
    if (type.getSymbol()?.name === name) return true
    if (type.isUnionOrIntersection()) {
        return type.types.some(t => typeMatches(checker, t, name))
    }
    // Follow generic constraints: a `<T extends StoreData>(data: T)` receiver
    // is a StoreData for mutation purposes and must not slip the guard.
    if (type.isTypeParameter()) {
        const constraint = checker.getBaseConstraintOfType(type)
        if (constraint && constraint !== type) {
            return typeMatches(checker, constraint, name)
        }
    }
    return false
}

const isAnyOrUnknown = (type: ts.Type): boolean =>
    (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) !== 0

/** Alias kinds a local variable can hold: a graph table itself, or a Set
 *  value retrieved from one. Carries the underlying table for reporting. */
type AliasKind = "table" | "value"
type AliasInfo = { kind: AliasKind; property: string }

export const scanSourceFileForGraphMutations = (
    sourceFile: ts.SourceFile,
    checker: ts.TypeChecker,
): MutationViolation[] => {
    const violations: MutationViolation[] = []
    const aliases = new Map<string, AliasInfo>()

    const report = (node: ts.Node, property: string) => {
        const { line } = sourceFile.getLineAndCharacterOfPosition(
            node.getStart(sourceFile),
        )
        violations.push({
            file: sourceFile.fileName,
            line: line + 1,
            property,
            text: node.getText(sourceFile).split("\n")[0]!.slice(0, 120),
        })
    }

    /** `expr.prop` / `expr["prop"]` where prop is an owned name and expr
     *  resolves to StoreData (or is untyped). Returns the property name, else
     *  undefined. A computed access with a NON-literal key on a StoreData
     *  receiver is flagged conservatively as `<computed>` when it appears in
     *  a mutating position — the key cannot be proven safe statically, and
     *  production code has no legitimate reason to mutate StoreData through
     *  a dynamic key. */
    const graphTableAccess = (
        node: ts.Expression,
        names: Set<string>,
    ): string | undefined => {
        const expr = stripWrappers(node)
        let property: string | undefined
        let baseNode: ts.Expression
        if (ts.isPropertyAccessExpression(expr)) {
            property = expr.name.text
            baseNode = expr.expression
        } else if (ts.isElementAccessExpression(expr)) {
            const argument = stripWrappers(expr.argumentExpression)
            if (ts.isStringLiteralLike(argument)) {
                property = argument.text
            } else {
                // Symbol-keyed slots (e.g. the STORE_RUNTIME facade slot)
                // cannot name a string-keyed graph table — exempt them.
                const keyType = checker.getTypeAtLocation(argument)
                if (
                    (keyType.flags &
                        (ts.TypeFlags.ESSymbol |
                            ts.TypeFlags.UniqueESSymbol)) !==
                    0
                ) {
                    return undefined
                }
                property = undefined
            }
            baseNode = expr.expression
        } else {
            return undefined
        }
        if (property !== undefined && !names.has(property)) return undefined
        const base = stripWrappers(baseNode)
        const baseType = checker.getTypeAtLocation(base)
        if (
            typeMatches(checker, baseType, "StoreData") ||
            isAnyOrUnknown(baseType)
        ) {
            return property ?? "<computed>"
        }
        return undefined
    }

    /** `T.get(...)` (possibly optional-chained) where T is a graph table. */
    const tableValueRetrieval = (node: ts.Expression): string | undefined => {
        const expr = stripWrappers(node)
        if (!ts.isCallExpression(expr)) return undefined
        const callee = stripWrappers(expr.expression)
        if (!ts.isPropertyAccessExpression(callee)) return undefined
        if (callee.name.text !== "get") return undefined
        const table = graphTableAccess(callee.expression, GRAPH_TABLES)
        if (table) return table
        // Alias-of-alias: `tableAlias.get(...)`.
        const receiver = stripWrappers(callee.expression)
        if (ts.isIdentifier(receiver)) {
            const alias = aliases.get(receiver.text)
            if (alias?.kind === "table") return alias.property
        }
        return undefined
    }

    /** Initializers that produce a table or contained-Set alias, including
     *  `expr ?? new Set()` / `expr || fallback` shapes. */
    const aliasKindOfInitializer = (
        init: ts.Expression,
    ): AliasInfo | undefined => {
        const expr = stripWrappers(init)
        const table = graphTableAccess(expr, GRAPH_TABLES)
        if (table) return { kind: "table", property: table }
        const value = tableValueRetrieval(expr)
        if (value) return { kind: "value", property: value }
        if (ts.isBinaryExpression(expr)) {
            const op = expr.operatorToken.kind
            if (
                op === ts.SyntaxKind.QuestionQuestionToken ||
                op === ts.SyntaxKind.BarBarToken
            ) {
                return (
                    aliasKindOfInitializer(expr.left) ??
                    aliasKindOfInitializer(expr.right)
                )
            }
        }
        if (ts.isIdentifier(expr)) return aliases.get(expr.text)
        return undefined
    }

    const recordDeclarationAliases = (declaration: ts.VariableDeclaration) => {
        const init = declaration.initializer
        if (!init) return
        if (ts.isIdentifier(declaration.name)) {
            const alias = aliasKindOfInitializer(init)
            // A non-alias initializer SHADOWS any earlier same-named alias —
            // the map is file-scoped, so "most recent declaration wins" keeps
            // an unrelated local (`const downstream = new Map()`) from
            // inheriting an alias recorded in a previous function.
            if (alias) aliases.set(declaration.name.text, alias)
            else aliases.delete(declaration.name.text)
            return
        }
        // Destructuring a graph table straight off a StoreData-typed object:
        // `const { stateDependents } = data`, including string-literal and
        // computed-literal keys (`const { ["stateDependents"]: t } = data`).
        if (ts.isObjectBindingPattern(declaration.name)) {
            const initType = checker.getTypeAtLocation(stripWrappers(init))
            if (
                !typeMatches(checker, initType, "StoreData") &&
                !isAnyOrUnknown(initType)
            )
                return
            for (const element of declaration.name.elements) {
                const key = element.propertyName ?? element.name
                let property: string | undefined
                if (ts.isIdentifier(key)) {
                    property = key.text
                } else if (ts.isStringLiteralLike(key)) {
                    property = key.text
                } else if (
                    ts.isComputedPropertyName(key) &&
                    ts.isStringLiteralLike(stripWrappers(key.expression))
                ) {
                    property = (
                        stripWrappers(key.expression) as ts.StringLiteralLike
                    ).text
                }
                if (
                    property &&
                    GRAPH_TABLES.has(property) &&
                    ts.isIdentifier(element.name)
                ) {
                    aliases.set(element.name.text, {
                        kind: "table",
                        property,
                    })
                }
            }
        }
    }

    const visit = (node: ts.Node): void => {
        if (ts.isVariableDeclaration(node)) recordDeclarationAliases(node)

        // Method-call mutations: X.set/add/delete/clear(...)
        if (ts.isCallExpression(node)) {
            const callee = stripWrappers(node.expression)
            if (
                ts.isPropertyAccessExpression(callee) &&
                MUTATING_METHODS.has(callee.name.text)
            ) {
                const receiverRaw = callee.expression
                const receiver = stripWrappers(receiverRaw)
                const direct = graphTableAccess(receiverRaw, GRAPH_TABLES)
                if (direct) {
                    report(node, direct)
                } else {
                    const chained = tableValueRetrieval(receiverRaw)
                    if (chained) {
                        report(node, chained)
                    } else if (ts.isIdentifier(receiver)) {
                        const alias = aliases.get(receiver.text)
                        if (alias) report(node, alias.property)
                    }
                }
            }
        }

        // Assignment mutations: data.<field> = / ??= / ++ / --
        if (
            ts.isBinaryExpression(node) &&
            ASSIGNMENT_OPS.has(node.operatorToken.kind)
        ) {
            const target = graphTableAccess(
                node.left,
                new Set([...GRAPH_TABLES, ...GRAPH_SCALARS]),
            )
            if (target) report(node, target)
            // Track alias reassignment: `deps = data.stateDependencies.get(x)`.
            if (
                node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
                ts.isIdentifier(node.left)
            ) {
                const alias = aliasKindOfInitializer(node.right)
                if (alias) aliases.set(node.left.text, alias)
                else aliases.delete(node.left.text)
            }
        }
        if (
            (ts.isPrefixUnaryExpression(node) ||
                ts.isPostfixUnaryExpression(node)) &&
            (node.operator === ts.SyntaxKind.PlusPlusToken ||
                node.operator === ts.SyntaxKind.MinusMinusToken)
        ) {
            const target = graphTableAccess(
                node.operand,
                new Set([...GRAPH_TABLES, ...GRAPH_SCALARS]),
            )
            if (target) report(node, target)
        }

        ts.forEachChild(node, visit)
    }

    visit(sourceFile)
    return violations
}

/** Build one checker program over the package's production sources. */
export const createProductionProgram = (rootRelPaths: string[]): ts.Program => {
    const configPath = resolve(PACKAGE_ROOT, "tsconfig.json")
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile)
    const parsed = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        PACKAGE_ROOT,
    )
    return ts.createProgram({
        rootNames: rootRelPaths.map(rel => resolve(PACKAGE_ROOT, rel)),
        options: { ...parsed.options, noEmit: true, declaration: false },
    })
}

/** Compile an inline fixture against stub graph types and scan it — used by
 *  the guard's own positive/negative fixture tests. */
export const scanFixture = (code: string): MutationViolation[] => {
    const FIXTURE_TYPES = `
export type State = { __state: true }
export type StoreData = {
    parent?: StoreData
    stateDependencies: WeakMap<object, Set<State>>
    stateDependents: WeakMap<object, Set<State>>
    selectorGraphActive: WeakSet<object>
    inheritedDependencyBranches: WeakMap<object, Set<StoreData>>
    inheritedDependencyKeys?: Set<object>
    graphNodes: WeakMap<object, { live: number }>
    mounts: WeakMap<object, { cleanup?: () => void }>
    livenessSeeds?: Set<State>
    livenessPassActive?: boolean
    livenessRemovalArmed?: boolean
    livenessLazyArmed?: boolean
    nextDependencyOrder: number
    dependencyGraphVersion: number
    pendingOrphanCleanup?: Set<State>
    orphanCleanupScheduled: boolean
    values: WeakMap<object, unknown>
    subscriptions: WeakMap<object, Set<object>>
}
export type SelectorEvaluationRuntime = {
    stateDependencies: Map<object, Set<State>>
}
export type StoreResources = {
    mounts: Set<State>
}
`
    const files = new Map<string, string>([
        ["/fixture-types.ts", FIXTURE_TYPES],
        [
            "/fixture.ts",
            `import type { State, StoreData, SelectorEvaluationRuntime, StoreResources } from "./fixture-types"\n${code}`,
        ],
    ])
    const options: ts.CompilerOptions = {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        strict: true,
        noEmit: true,
    }
    const host = ts.createCompilerHost(options)
    const realGetSourceFile = host.getSourceFile.bind(host)
    host.getSourceFile = (fileName, languageVersion, ...rest) => {
        const virtual = files.get(fileName)
        if (virtual !== undefined) {
            return ts.createSourceFile(
                fileName,
                virtual,
                languageVersion,
                true,
            )
        }
        return realGetSourceFile(fileName, languageVersion, ...rest)
    }
    const realFileExists = host.fileExists.bind(host)
    host.fileExists = fileName =>
        files.has(fileName) || realFileExists(fileName)
    const realReadFile = host.readFile.bind(host)
    host.readFile = fileName => files.get(fileName) ?? realReadFile(fileName)

    const program = ts.createProgram({
        rootNames: ["/fixture.ts"],
        options,
        host,
    })
    const sourceFile = program.getSourceFile("/fixture.ts")!
    return scanSourceFileForGraphMutations(sourceFile, program.getTypeChecker())
}
