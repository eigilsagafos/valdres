import { describe, expect, test } from "bun:test"
import { resolve } from "node:path"
import { buildImportGraph, computeSccs, PACKAGE_ROOT } from "./importGraph"
import {
    createProductionProgram,
    scanFixture,
    scanSourceFileForGraphMutations,
} from "./graphTableMutationScan"

/**
 * GraphRuntime boundary guard (see src/lib/graph/index.ts for the contract):
 *
 * 1. Import structure — the graph cluster is a LEAF layer: none of its files
 *    participates in any import cycle, its full transitive runtime-import
 *    closure stays inside graph/ plus a fixed leaf allowlist, and non-graph
 *    production code enters only through the facade. The historical core SCC
 *    is pinned to (a subset of) its current nine members so the 24→9
 *    reduction cannot silently regress — this asserts the TARGET, unlike the
 *    baseline ratchet, which a regeneration could otherwise re-bless.
 *
 * 2. Table ownership — no production module outside src/lib/graph/ writes a
 *    graph table on StoreData. Enforced with the TypeScript checker (receiver
 *    TYPE resolution + local alias tracking), not receiver regexes; fixture
 *    tests below prove the guard catches the real mutation shapes and ignores
 *    the sanctioned ones.
 */

const GRAPH_DIR = "src/lib/graph/"

/** The exact members of the one remaining core write-path SCC. Shrinking is
 *  welcome (subset allowed); growing or re-merging freed modules fails. */
const CORE_SCC_MEMBERS = new Set([
    "src/lib/coordinateAsyncWrite.ts",
    "src/lib/getState.ts",
    "src/lib/globalAtomFanOut.ts",
    "src/lib/initAtom.ts",
    "src/lib/initSelector.ts",
    "src/lib/propagateUpdatedAtoms.ts",
    "src/lib/resolveAtomDefaultValue.ts",
    "src/lib/setAtom.ts",
    "src/lib/unsetValue.ts",
])

/** Every module the graph cluster may reach at runtime, transitively. Adding
 *  an import that escapes this set risks re-entering the write-path cycle —
 *  extend it only for genuine leaves, consciously. */
const GRAPH_LEAF_ALLOWLIST = new Set([
    "src/lib/IS_PROD.ts",
    "src/lib/storeLifecycle.ts",
    "src/lib/stateRevisions.ts",
    "src/lib/getStoreRuntime.ts",
    "src/lib/storeRuntimeKey.ts",
    // Shared-runtime registry; zero runtime imports of its own.
    "src/lib/valdresGlobal.ts",
    // Symbol-only leaf, zero imports of its own — reached via storeLifecycle,
    // exactly like storeRuntimeKey.
    "src/lib/storeCancellableKey.ts",
    "src/utils/isSelector.ts",
    "src/utils/isAtom.ts",
    "src/utils/isAtomFamily.ts",
    // Both reached from orphan cleanup's demote gate. Type-only/no imports of
    // their own, so neither can re-enter the write path.
    "src/lib/hasCommittedValue.ts",
    "src/utils/isPromiseLike.ts",
    "src/errors/StoreDisposedError.ts",
    // Shared error-brand helper; zero imports of its own.
    "src/errors/lib/errorBrand.ts",
    // The tree sidecar, reached through stateRevisions when orphan cleanup's
    // demote gate records a cold snapshot: recording now asks the tree whether
    // the validating walk's evidence still holds (coldValidationMayRecord).
    // Its own two imports are BOTH type-only, so it has no runtime edges at all
    // and cannot re-enter the write path.
    "src/lib/storeTreeRuntime.ts",
])

/** Production files allowed to write graph-table fields directly. */
const MUTATION_ALLOWLIST = new Set([
    // Constructor-owned field initialization (fixes the hidden class); the
    // store is not observable while createStoreData runs.
    "src/lib/createStoreData.ts",
])

describe("graph import structure", () => {
    const graph = buildImportGraph()
    const sccs = computeSccs(graph)

    test("no graph module participates in any import cycle", () => {
        const inCycles = sccs
            .flat()
            .filter(module => module.startsWith(GRAPH_DIR))
        expect(inCycles).toEqual([])
    })

    test("every SCC is a subset of the verified nine-module core", () => {
        for (const scc of sccs) {
            const escapees = scc.filter(module => !CORE_SCC_MEMBERS.has(module))
            expect(escapees).toEqual([])
        }
        expect(Math.max(0, ...sccs.map(scc => scc.length))).toBeLessThanOrEqual(
            CORE_SCC_MEMBERS.size,
        )
    })

    test("graph cluster's transitive runtime closure stays on leaves", () => {
        const roots = [...graph.keys()].filter(module =>
            module.startsWith(GRAPH_DIR),
        )
        expect(roots.length).toBeGreaterThanOrEqual(9)
        const closure = new Set(roots)
        const queue = [...roots]
        while (queue.length > 0) {
            for (const target of graph.get(queue.pop()!) ?? []) {
                if (!closure.has(target)) {
                    closure.add(target)
                    queue.push(target)
                }
            }
        }
        const escapees = [...closure]
            .filter(module => !module.startsWith(GRAPH_DIR))
            .filter(module => !GRAPH_LEAF_ALLOWLIST.has(module))
            .sort()
        expect(escapees).toEqual([])
    })

    test("non-graph production code imports only the graph facade", () => {
        const offenders: string[] = []
        for (const [module, edges] of graph) {
            if (module.startsWith(GRAPH_DIR)) continue
            for (const target of edges) {
                if (
                    target.startsWith(GRAPH_DIR) &&
                    target !== "src/lib/graph/index.ts"
                ) {
                    offenders.push(`${module} -> ${target}`)
                }
            }
        }
        expect(offenders).toEqual([])
    })
})

describe("graph table ownership", () => {
    const modules = [...buildImportGraph().keys()]
    const program = createProductionProgram(modules)
    const checker = program.getTypeChecker()

    const violationsFor = (predicate: (module: string) => boolean) => {
        const found: string[] = []
        for (const module of modules) {
            if (!predicate(module)) continue
            const sourceFile = program.getSourceFile(
                resolve(PACKAGE_ROOT, module),
            )
            if (!sourceFile) continue
            for (const violation of scanSourceFileForGraphMutations(
                sourceFile,
                checker,
            )) {
                found.push(
                    `${module}:${violation.line} [${violation.property}] ${violation.text}`,
                )
            }
        }
        return found.sort()
    }

    test("no module outside src/lib/graph/ mutates a graph table", () => {
        const offenders = violationsFor(
            module =>
                !module.startsWith(GRAPH_DIR) &&
                !MUTATION_ALLOWLIST.has(module),
        )
        expect(offenders).toEqual([])
    })

    test("non-vacuity: the scan sees the graph runtime's own writes", () => {
        // If the table list, the type resolution, or module discovery silently
        // broke, the ownership test above would pass trivially. The graph
        // cluster performs dozens of these writes by design — require the
        // scanner to find them.
        const inGraph = violationsFor(module => module.startsWith(GRAPH_DIR))
        expect(inGraph.length).toBeGreaterThanOrEqual(30)
        // And the allowlisted constructor initializes most tables directly.
        const inConstructor = violationsFor(module =>
            MUTATION_ALLOWLIST.has(module),
        )
        expect(inConstructor.length).toBeGreaterThanOrEqual(3)
    })
})

describe("mutation-scan fixtures", () => {
    const flagged = (code: string) => scanFixture(code).map(v => v.property)

    test("catches direct table method calls", () => {
        expect(
            flagged(`export const f = (data: StoreData, s: State) => {
                data.stateDependents.set(s, new Set())
            }`),
        ).toEqual(["stateDependents"])
    })

    test("catches scalar assignments and increments", () => {
        expect(
            flagged(`export const f = (data: StoreData) => {
                data.dependencyGraphVersion++
                data.livenessLazyArmed = true
                data.livenessSeeds ??= new Set()
            }`),
        ).toEqual([
            "dependencyGraphVersion",
            "livenessLazyArmed",
            "livenessSeeds",
        ])
    })

    test("catches nested Set mutation through a value alias", () => {
        expect(
            flagged(`export const f = (data: StoreData, s: object, d: State) => {
                const deps = data.stateDependencies.get(s)
                deps!.add(d)
            }`),
        ).toEqual(["stateDependencies"])
    })

    test("catches chained value mutation without an alias", () => {
        expect(
            flagged(`export const f = (data: StoreData, s: object, d: State) => {
                data.stateDependents.get(s)?.add(d)
            }`),
        ).toEqual(["stateDependents"])
    })

    test("catches destructured and renamed receivers", () => {
        expect(
            flagged(`export const f = (data: StoreData, s: object) => {
                const { liveDependentCount } = data
                liveDependentCount.set(s, 1)
            }`),
        ).toEqual(["liveDependentCount"])
        expect(
            flagged(`export const f = (data: StoreData, s: object) => {
                const runtime = data
                runtime.selectorGraphActive.delete(s)
            }`),
        ).toEqual(["selectorGraphActive"])
        expect(
            flagged(`export const f = (data: StoreData, s: object) => {
                const table = data.mountInClosure
                table.delete(s)
            }`),
        ).toEqual(["mountInClosure"])
    })

    test("catches writes through an untyped receiver", () => {
        expect(
            flagged(`export const f = (data: any, s: object) => {
                data.stateDependents.delete(s)
            }`),
        ).toEqual(["stateDependents"])
    })

    test("catches writes through bracket access", () => {
        expect(
            flagged(`export const f = (data: StoreData, s: object) => {
                data["stateDependents"].set(s, new Set())
                data[\`liveDependentCount\`].set(s, 1)
            }`),
        ).toEqual(["stateDependents", "liveDependentCount"])
        // A computed non-literal string key on a StoreData receiver cannot be
        // proven safe — flagged conservatively in mutating positions.
        expect(
            flagged(`export const f = (
                data: StoreData,
                key: "stateDependents" | "stateDependencies",
                s: object,
            ) => {
                data[key].set(s, new Set())
            }`),
        ).toEqual(["<computed>"])
        // Bracket-keyed destructuring records the alias like dot access does.
        expect(
            flagged(`export const f = (data: StoreData, s: object) => {
                const { ["mountInClosure"]: table } = data
                table.delete(s)
            }`),
        ).toEqual(["mountInClosure"])
    })

    test("ignores symbol-keyed slots and unowned bracket planes", () => {
        expect(
            flagged(`declare const SLOT: unique symbol
            export const f = (
                data: StoreData & { [SLOT]?: number },
                s: object,
                v: unknown,
            ) => {
                data[SLOT] = 1
                data["values"].set(s, v)
            }`),
        ).toEqual([])
    })

    test("catches writes through a generic StoreData-constrained receiver", () => {
        expect(
            flagged(`export const f = <T extends StoreData>(data: T, s: State) => {
                data.stateDependents.set(s, new Set())
            }`),
        ).toEqual(["stateDependents"])
        // Indirect constraint chains resolve too.
        expect(
            flagged(`export const f = <
                T extends StoreData,
                U extends T,
            >(data: U, s: object) => {
                data.liveDependentCount.set(s, 1)
            }`),
        ).toEqual(["liveDependentCount"])
    })

    test("ignores reads, sentinels, comments, and strings", () => {
        expect(
            flagged(`declare const DISPOSED: Set<State>
            export const f = (data: StoreData, s: object) => {
                // data.stateDependents.set(s, new Set())
                const label = "data.stateDependents.set"
                const deps = data.stateDependencies.get(s)
                const terminal = data.pendingOrphanCleanup === DISPOSED
                return [label, deps?.size, terminal, data.mounts.has(s)]
            }`),
        ).toEqual([])
    })

    test("exempts the transaction overlay and the resource ledger by type", () => {
        expect(
            flagged(`export const f = (
                runtime: SelectorEvaluationRuntime,
                resources: StoreResources,
                s: object,
                d: State,
            ) => {
                runtime.stateDependencies.set(s, new Set())
                runtime.stateDependencies.get(s)?.add(d)
                resources.mounts.add(d)
                resources.mounts.delete(d)
            }`),
        ).toEqual([])
    })

    test("does not flag unowned StoreData planes", () => {
        expect(
            flagged(`export const f = (data: StoreData, s: object, v: unknown) => {
                data.values.set(s, v)
                data.subscriptions.get(s)?.delete(s as any)
            }`),
        ).toEqual([])
    })
})
